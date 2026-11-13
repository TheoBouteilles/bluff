-- 0017 : statistiques et trophées
-- Les faits marquants d'une partie sont figés à la fin de la partie (passage de rooms.phase à 'ended'),
-- avant que reset_room n'efface les actions de nuit, votes et trucages.
-- Joueur identifié par auth.uid() (session anonyme aujourd'hui, compte plus tard : même identifiant).
-- Parties en mode debug et bots : jamais comptés.
-- Aucun accès direct aux tables depuis le client : lecture via get_my_stats() et get_new_trophies().

-- ---------------------------------------------------------------------------
-- Tables
-- ---------------------------------------------------------------------------
create table if not exists public.game_history (
  id           uuid primary key default gen_random_uuid(),
  room_id      uuid not null,               -- pas de clé étrangère : les salons sont supprimés après 2 h
  room_code    text not null,
  winner       text,
  rounds       int  not null default 0,
  player_count int  not null default 0,
  ended_at     timestamptz not null default now()
);
create index if not exists game_history_room_idx on public.game_history (room_id, ended_at desc);

create table if not exists public.player_game_stats (
  game_id             uuid not null references public.game_history(id) on delete cascade,
  user_id             uuid not null references auth.users(id) on delete cascade,
  nickname            text,
  team                text,
  role_id             text,
  won                 boolean not null default false,
  alive_at_end        boolean not null default false,
  killed_round        int,                  -- tué la nuit (manche)
  eliminated_round    int,                  -- éliminé au vote (manche)
  nights_survived     int not null default 0,
  votes_cast          int not null default 0,
  votes_on_saboteur   int not null default 0,
  best_vote_streak    int not null default 0, -- manches consécutives à voter contre un Saboteur
  wrongly_eliminated  boolean not null default false,
  casino_bets         int not null default 0,
  casino_wins         int not null default 0,
  casino_net          int not null default 0,
  casino_best_win     int not null default 0,
  casino_jackpot      boolean not null default false,
  casino_lose_streak  int not null default 0,
  gifts_given         int not null default 0,
  gifts_received      int not null default 0, -- jetons reçus en cadeau
  mairie_success      int not null default 0,
  mairie_fail         int not null default 0,
  mairie_kill         boolean not null default false,
  sabotages_ok        int not null default 0,
  kills               int not null default 0, -- morts dans un lieu où le joueur était, en Saboteur
  ghost_suspect_right boolean,                -- null si jamais fantôme ou sans suspect
  cemetery_good_hints int not null default 0,
  locations           jsonb not null default '{}'::jsonb,
  primary key (game_id, user_id)
);
create index if not exists player_game_stats_user_idx on public.player_game_stats (user_id);

create table if not exists public.player_trophies (
  user_id     uuid not null references auth.users(id) on delete cascade,
  trophy_id   text not null,
  game_id     uuid references public.game_history(id) on delete set null,
  unlocked_at timestamptz not null default now(),
  primary key (user_id, trophy_id)
);

alter table public.game_history      enable row level security;
alter table public.player_game_stats enable row level security;
alter table public.player_trophies   enable row level security;
-- Aucune policy : tout passe par les fonctions security definer ci-dessous.

-- ---------------------------------------------------------------------------
-- Enregistrement d'une partie terminée
-- ---------------------------------------------------------------------------
create or replace function public.record_game_stats(p_room uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_room       public.rooms;
  v_game       uuid;
  v_casino_max int := public.room_param(p_room, 'casino_max');
  v_nsab       int;
  v_alive_sab  int;
  p            record;
  r            record;
  -- valeurs par joueur
  v_won        boolean;
  v_killed     int;
  v_elim       int;
  v_nights     int;
  v_cast       int;
  v_onsab      int;
  v_streak     int;
  v_best       int;
  v_last       int;
  v_bets       int;
  v_cwins      int;
  v_net        int;
  v_bestwin    int;
  v_jackpot    boolean;
  v_lose       int;
  v_lose_best  int;
  v_given      int;
  v_received   int;
  v_msucc      int;
  v_mfail      int;
  v_mkill      boolean;
  v_sabok      int;
  v_kills      int;
  v_ghost_ok   boolean;
  v_hints      int;
  v_locs       jsonb;
  -- cumul toutes parties
  t_games      int;
  t_alive      int;
  t_gifts      int;
  t_sabok      int;
  v_trophies   text[];
begin
  select * into v_room from public.rooms where id = p_room;
  if not found or v_room.debug then return; end if;

  select count(*) filter (where s.team = 'saboteurs'),
         count(*) filter (where s.team = 'saboteurs' and pl.is_alive)
  into v_nsab, v_alive_sab
  from public.players pl join public.player_secrets s on s.player_id = pl.id
  where pl.room_id = p_room;

  insert into public.game_history (room_id, room_code, winner, rounds, player_count)
  values (p_room, v_room.code, v_room.winner, v_room.round,
          (select count(*) from public.players where room_id = p_room))
  returning id into v_game;

  for p in
    select pl.id, pl.user_id, pl.nickname, pl.is_alive, s.team, s.role_id
    from public.players pl
    join public.player_secrets s on s.player_id = pl.id
    where pl.room_id = p_room and not pl.is_bot and pl.user_id is not null
  loop
    v_won := (v_room.winner = 'villageois' and p.team = 'villageois')
          or (v_room.winner = 'saboteurs'  and p.team = 'saboteurs');

    select min(round) into v_killed from public.night_deaths  where room_id = p_room and victim_id = p.id;
    select min(round) into v_elim   from public.vote_results  where room_id = p_room and eliminated_id = p.id;

    select count(*) into v_nights from public.night_actions where room_id = p_room and player_id = p.id;
    if v_killed is not null then v_nights := greatest(0, v_nights - 1); end if;

    -- Votes (après départage, seul le dernier tour de vote de la manche est conservé)
    v_cast := 0; v_onsab := 0; v_streak := 0; v_best := 0; v_last := null;
    for r in
      select vo.round, vo.target_id, ts.team as tteam
      from public.votes vo
      left join public.player_secrets ts on ts.player_id = vo.target_id
      where vo.room_id = p_room and vo.voter_id = p.id
      order by vo.round
    loop
      if r.target_id is not null then v_cast := v_cast + 1; end if;
      if v_last is not null and r.round <> v_last + 1 then v_streak := 0; end if;
      if r.tteam = 'saboteurs' then
        v_onsab := v_onsab + 1;
        v_streak := v_streak + 1;
        v_best := greatest(v_best, v_streak);
      else
        v_streak := 0;
      end if;
      v_last := r.round;
    end loop;

    -- Casino
    v_bets := 0; v_cwins := 0; v_net := 0; v_bestwin := 0; v_jackpot := false; v_lose := 0; v_lose_best := 0;
    for r in
      select (na.result->'casino'->>'stake')::int as stake, (na.result->'casino'->>'won')::boolean as won
      from public.night_actions na
      where na.room_id = p_room and na.player_id = p.id and na.result ? 'casino'
      order by na.round
    loop
      v_bets := v_bets + 1;
      if r.won then
        v_cwins := v_cwins + 1;
        v_net := v_net + r.stake;
        v_bestwin := greatest(v_bestwin, r.stake);
        if r.stake >= v_casino_max then v_jackpot := true; end if;
        v_lose := 0;
      else
        v_net := v_net - r.stake;
        v_lose := v_lose + 1;
        v_lose_best := greatest(v_lose_best, v_lose);
      end if;
    end loop;

    -- Taverne
    select count(*) filter (where na.result->'don'->>'ok' = 'true'),
           coalesce(sum(public.try_int(na.result->>'gifts_received')), 0)
    into v_given, v_received
    from public.night_actions na
    where na.room_id = p_room and na.player_id = p.id;

    -- Mairie (un trucage saboté compte comme raté, même si le joueur a cru réussir)
    select count(*) into v_msucc from public.vote_tampering
    where room_id = p_room and player_id = p.id and kind in ('boost', 'shield');
    select count(*) into v_mfail from public.night_actions na
    where na.room_id = p_room and na.player_id = p.id
      and na.result->'mairie'->>'attempted' = 'true'
      and not exists (select 1 from public.vote_tampering vt
                      where vt.room_id = p_room and vt.round = na.round and vt.player_id = p.id
                        and vt.kind in ('boost', 'shield'));
    v_mkill := exists (
      select 1 from public.vote_tampering vt
      join public.vote_results vr on vr.room_id = vt.room_id and vr.round = vt.round
      where vt.room_id = p_room and vt.player_id = p.id and vt.kind = 'boost'
        and vr.eliminated_id = vt.target_id);

    -- Planque : fermetures réussies (hors lieu déjà payé par un allié)
    select count(*) into v_sabok from public.night_actions na
    where na.room_id = p_room and na.player_id = p.id
      and na.result->'sabotage'->>'success' = 'true'
      and coalesce(na.result->'sabotage'->>'shared', 'false') <> 'true';

    -- Meurtres : en Saboteur, morts survenues dans un lieu où l'on était
    v_kills := 0;
    if p.team = 'saboteurs' then
      select count(*) into v_kills
      from public.night_deaths d
      join public.night_actions na on na.room_id = d.room_id and na.round = d.round
                                  and na.location = d.location and na.player_id = p.id
      where d.room_id = p_room;
    end if;

    -- Fantôme : son suspect final est-il un Saboteur ?
    select gs.team = 'saboteurs' into v_ghost_ok
    from public.ghost_hints h
    join public.player_secrets gs on gs.player_id = h.suspect_id
    where h.player_id = p.id;
    if p.is_alive then v_ghost_ok := null; end if;

    -- Cimetière : indices reçus qui désignent un vrai Saboteur
    select count(*) into v_hints
    from public.night_actions na
    cross join lateral jsonb_array_elements(coalesce(na.result->'cimetiere'->'spirits', '[]'::jsonb)) sp
    join public.player_secrets ss on ss.player_id = public.try_uuid(sp->>'suspect_id')
    where na.room_id = p_room and na.player_id = p.id and ss.team = 'saboteurs';

    select coalesce(jsonb_object_agg(x.location, x.n), '{}'::jsonb) into v_locs
    from (select location, count(*) as n from public.night_actions
          where room_id = p_room and player_id = p.id group by location) x;

    insert into public.player_game_stats (
      game_id, user_id, nickname, team, role_id, won, alive_at_end, killed_round, eliminated_round,
      nights_survived, votes_cast, votes_on_saboteur, best_vote_streak, wrongly_eliminated,
      casino_bets, casino_wins, casino_net, casino_best_win, casino_jackpot, casino_lose_streak,
      gifts_given, gifts_received, mairie_success, mairie_fail, mairie_kill, sabotages_ok, kills,
      ghost_suspect_right, cemetery_good_hints, locations)
    values (
      v_game, p.user_id, p.nickname, p.team, p.role_id, v_won, p.is_alive, v_killed, v_elim,
      v_nights, v_cast, v_onsab, v_best, (v_elim is not null and p.team <> 'saboteurs'),
      v_bets, v_cwins, v_net, v_bestwin, v_jackpot, v_lose_best,
      v_given, v_received, v_msucc, v_mfail, v_mkill, v_sabok, v_kills,
      v_ghost_ok, v_hints, v_locs)
    on conflict (game_id, user_id) do nothing;

    -- Trophées
    select count(*), count(*) filter (where alive_at_end), sum(gifts_given), sum(sabotages_ok)
    into t_games, t_alive, t_gifts, t_sabok
    from public.player_game_stats where user_id = p.user_id;

    v_trophies := array_remove(array[
      'premiere_partie',
      case when t_games >= 10 then 'veteran' end,
      case when t_games >= 50 then 'pilier' end,
      case when t_alive >= 5 then 'increvable' end,
      case when v_killed = 1 then 'mauvais_endroit' end,
      case when v_elim is not null and p.team <> 'saboteurs' then 'bouc_emissaire' end,
      case when v_best >= 3 then 'fin_limier' end,
      case when p.team = 'saboteurs' and v_won and p.is_alive and v_nsab >= 2 and v_alive_sab = 1
           then 'loup_solitaire' end,
      case when v_kills >= 3 then 'massacre' end,
      case when v_jackpot then 'jackpot' end,
      case when v_lose_best >= 3 then 'ruine' end,
      case when v_mkill then 'maire_vereux' end,
      case when v_mfail > 0 then 'main_dans_le_sac' end,
      case when t_gifts >= 5 then 'pere_noel' end,
      case when t_sabok >= 3 then 'serrurier' end,
      case when v_hints > 0 then 'medium' end,
      case when v_ghost_ok and p.team <> 'saboteurs' then 'fantome_rancunier' end
    ], null);

    insert into public.player_trophies (user_id, trophy_id, game_id)
    select p.user_id, t, v_game from unnest(v_trophies) t
    on conflict (user_id, trophy_id) do nothing;
  end loop;
end $$;

-- Déclencheur : une erreur dans les stats ne doit jamais bloquer la fin de partie
create or replace function public.trg_record_game_stats()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  begin
    perform public.record_game_stats(new.id);
  exception when others then
    raise warning 'record_game_stats(%) : %', new.id, sqlerrm;
  end;
  return new;
end $$;

drop trigger if exists rooms_record_stats on public.rooms;
create trigger rooms_record_stats
after update of phase on public.rooms
for each row
when (new.phase = 'ended' and old.phase is distinct from 'ended')
execute function public.trg_record_game_stats();

revoke all on function public.record_game_stats(uuid) from public, anon, authenticated;
revoke all on function public.trg_record_game_stats() from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- Lecture
-- ---------------------------------------------------------------------------
create or replace function public.get_my_stats()
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_uid    uuid := auth.uid();
  r        record;
  v_cur    int := 0;
  v_best   int := 0;
  v_out    jsonb;
begin
  if v_uid is null then raise exception 'not_authenticated'; end if;

  -- Séries de victoires (ordre chronologique)
  for r in
    select s.won from public.player_game_stats s
    join public.game_history g on g.id = s.game_id
    where s.user_id = v_uid order by g.ended_at
  loop
    if r.won then v_cur := v_cur + 1; v_best := greatest(v_best, v_cur); else v_cur := 0; end if;
  end loop;

  select jsonb_build_object(
    'games',              count(*),
    'wins',               count(*) filter (where won),
    'villageois_games',   count(*) filter (where team = 'villageois'),
    'villageois_wins',    count(*) filter (where team = 'villageois' and won),
    'saboteurs_games',    count(*) filter (where team = 'saboteurs'),
    'saboteurs_wins',     count(*) filter (where team = 'saboteurs' and won),
    'nights_survived',    coalesce(sum(nights_survived), 0),
    'killed',             count(*) filter (where killed_round is not null),
    'eliminated',         count(*) filter (where eliminated_round is not null),
    'alive_at_end',       count(*) filter (where alive_at_end),
    'votes_cast',         coalesce(sum(votes_cast), 0),
    'votes_on_saboteur',  coalesce(sum(votes_on_saboteur), 0),
    'wrongly_eliminated', count(*) filter (where wrongly_eliminated),
    'casino_bets',        coalesce(sum(casino_bets), 0),
    'casino_wins',        coalesce(sum(casino_wins), 0),
    'casino_net',         coalesce(sum(casino_net), 0),
    'casino_best_win',    coalesce(max(casino_best_win), 0),
    'gifts_given',        coalesce(sum(gifts_given), 0),
    'gifts_received',     coalesce(sum(gifts_received), 0),
    'mairie_success',     coalesce(sum(mairie_success), 0),
    'mairie_fail',        coalesce(sum(mairie_fail), 0),
    'kills',              coalesce(sum(kills), 0),
    'sabotages_ok',       coalesce(sum(sabotages_ok), 0),
    'ghost_games',        count(*) filter (where ghost_suspect_right is not null),
    'ghost_right',        count(*) filter (where ghost_suspect_right),
    'cemetery_good_hints', coalesce(sum(cemetery_good_hints), 0)
  ) into v_out
  from public.player_game_stats where user_id = v_uid;

  return v_out || jsonb_build_object(
    'current_streak', v_cur,
    'best_streak',    v_best,
    'locations', coalesce((
      select jsonb_object_agg(x.k, x.n) from (
        select l.key as k, sum(l.value::int) as n
        from public.player_game_stats s, jsonb_each_text(s.locations) l
        where s.user_id = v_uid group by l.key) x), '{}'::jsonb),
    'trophies', coalesce((
      select jsonb_agg(jsonb_build_object('id', trophy_id, 'unlocked_at', unlocked_at) order by unlocked_at)
      from public.player_trophies where user_id = v_uid), '[]'::jsonb),
    'recent', coalesce((
      select jsonb_agg(x.j order by x.ended_at desc) from (
        select g.ended_at, jsonb_build_object(
          'ended_at', g.ended_at, 'room_code', g.room_code, 'rounds', g.rounds,
          'team', s.team, 'role_id', s.role_id, 'won', s.won, 'alive_at_end', s.alive_at_end) as j
        from public.player_game_stats s join public.game_history g on g.id = s.game_id
        where s.user_id = v_uid order by g.ended_at desc limit 10) x), '[]'::jsonb)
  );
end $$;

-- Trophées débloqués par le joueur connecté lors de la dernière partie de ce salon
create or replace function public.get_new_trophies(p_room_id uuid)
returns text[]
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(array_agg(t.trophy_id order by t.unlocked_at), '{}')
  from public.player_trophies t
  where t.user_id = auth.uid()
    and t.game_id = (select g.id from public.game_history g
                     where g.room_id = p_room_id order by g.ended_at desc limit 1);
$$;

revoke execute on function public.get_my_stats() from public, anon;
revoke execute on function public.get_new_trophies(uuid) from public, anon;
grant execute on function public.get_my_stats() to authenticated;
grant execute on function public.get_new_trophies(uuid) to authenticated;
