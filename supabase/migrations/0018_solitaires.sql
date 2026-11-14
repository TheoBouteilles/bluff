-- 0018 : les deux Solitaires (Capitaliste, Opportuniste), en option selon le nombre de joueurs
-- Les autres rôles spéciaux sont abandonnés : la partie reste Villageois / Saboteurs (+ Solitaires en option).
--
-- Capitaliste : gagne (seul) dès qu'il détient `capitaliste_goal` jetons, même s'il meurt ensuite.
-- Opportuniste : parie en secret sur un camp (1er choix gratuit, changement = `opportuniste_switch_cost`, la nuit).
--                Gagne s'il est en vie à la fin et que son camp l'emporte.
-- Les Solitaires comptent parmi les « non-Saboteurs » : ils peuvent être tués, passent pour innocents
-- aux rumeurs et comptent face aux Saboteurs pour la victoire. Revenu de nuit = celui des Villageois.

-- ---------------------------------------------------------------------------
-- Données
-- ---------------------------------------------------------------------------
alter table public.player_secrets add column if not exists side text
  check (side in ('villageois', 'saboteurs'));
alter table public.player_secrets add column if not exists solo_won boolean not null default false;

-- ---------------------------------------------------------------------------
-- Paramètres
-- ---------------------------------------------------------------------------
create or replace function public.game_param(p_key text)
returns integer
language sql
immutable
set search_path = public
as $$
  select case p_key
    when 'poste_garde_cost' then 2
    when 'planque_cost'     then 2
    when 'rumeur3_cost'     then 2
    when 'rumeur2_cost'     then 3
    when 'don_cost'         then 1
    when 'casino_max'       then 3
    when 'casino_win_pct'   then 50
    when 'mairie_cost'      then 2
    when 'kill_majority_pct' then 100  -- Saboteurs > Villageois dans un lieu
    when 'kill_tie_pct'     then 50    -- Saboteurs = Villageois
    when 'kill_minority_pct' then 0    -- Saboteurs < Villageois (au moins un Saboteur présent)
    when 'death_reveals_location' then 0
    when 'tokens_start_villager'  then 1
    when 'tokens_start_saboteur'  then 2   -- chaque Saboteur, quand ils sont plusieurs
    when 'tokens_start_saboteur_solo' then 3 -- Saboteur seul
    when 'tokens_income_villager' then 1   -- jetons gagnés chaque nuit (à partir de la nuit 2)
    when 'tokens_income_saboteur' then 1
    when 'saboteurs_count'  then 0     -- 0 = automatique (1 jusqu'à 5 joueurs, 2 à partir de 6)
    when 'vote_runoff_max'  then 3     -- nombre de nouveaux votes en cas d'égalité
    when 'cemetery_cost'    then 1     -- coût pour choisir une tombe au Cimetière
    when 'tomb_count'       then 3     -- nombre de tombes
    when 'mairie_boost'     then 1     -- voix ajoutées par un trucage réussi à la Mairie
    when 'rumeur_small_cost' then 4    -- rumeur en petite partie : toujours 3 joueurs ciblés, à ce prix
    when 'rumeur_small_max_players' then 5  -- « petite partie » = au plus ce nombre de joueurs (0 = jamais)
    when 'sudden_death_on'  then 1     -- 1 = mort subite à égalité Saboteurs / autres, 0 = les Saboteurs gagnent aussitôt
    when 'timers_on'        then 0     -- 1 = minuteurs actifs
    when 'night_seconds'    then 120
    when 'day_seconds'      then 300
    when 'vote_seconds'     then 90
    when 'casino_sabotage_steal' then 1  -- casino saboté : le saboteur empoche la moitié des mises jouées
    when 'planque_kill_first'    then 1  -- Planque : le meurtre est résolu avant le sabotage
    when 'cemetery_named'        then 1  -- Cimetière : on choisit le fantôme par son nom (fantômes non saboteurs)
    when 'ghost_haunt_on'        then 1  -- fantôme saboteur : peut hanter le lieu d'un saboteur vivant
    when 'ghost_haunt_bonus_pct' then 25 -- points de chance de meurtre ajoutés par fantôme qui hante
    when 'saboteur_vision'       then 1  -- les Saboteurs (et fantômes saboteurs) voient les lieux validés de leurs alliés
    when 'solitaires_on'         then 1  -- 1 = Solitaires distribués selon le nombre de joueurs, 0 = jamais
    when 'solitaire1_min_players' then 7 -- 1 Solitaire à partir de ce nombre de joueurs
    when 'solitaire2_min_players' then 8 -- 2 Solitaires à partir de ce nombre de joueurs
    when 'capitaliste_goal'      then 10 -- jetons à détenir pour la victoire du Capitaliste
    when 'opportuniste_switch_cost' then 2 -- coût pour changer de camp (le premier choix est gratuit)
  end;
$$;

create or replace function public.setting_bounds()
returns table(key text, lo integer, hi integer)
language sql
immutable
set search_path = public
as $$
  values
    ('saboteurs_count', 0, 4), ('tokens_start_villager', 0, 10), ('tokens_start_saboteur', 0, 10),
    ('tokens_income_villager', 0, 5), ('tokens_income_saboteur', 0, 5),
    ('kill_majority_pct', 0, 100), ('kill_tie_pct', 0, 100), ('kill_minority_pct', 0, 100),
    ('death_reveals_location', 0, 1),
    ('poste_garde_cost', 0, 9), ('planque_cost', 0, 9), ('rumeur3_cost', 0, 9), ('rumeur2_cost', 0, 9),
    ('don_cost', 0, 9), ('mairie_cost', 0, 9), ('casino_max', 0, 9), ('casino_win_pct', 0, 100),
    ('cemetery_cost', 0, 9), ('tomb_count', 2, 6),
    ('mairie_boost', 1, 3), ('rumeur_small_cost', 0, 9), ('rumeur_small_max_players', 0, 10), ('sudden_death_on', 0, 1),
    ('tokens_start_saboteur_solo', 0, 10),
    ('timers_on', 0, 1), ('night_seconds', 30, 600), ('day_seconds', 30, 900), ('vote_seconds', 30, 600),
    ('casino_sabotage_steal', 0, 1), ('planque_kill_first', 0, 1), ('cemetery_named', 0, 1),
    ('ghost_haunt_on', 0, 1), ('ghost_haunt_bonus_pct', 0, 100), ('saboteur_vision', 0, 1),
    ('vote_runoff_max', 0, 9),
    ('solitaires_on', 0, 1), ('solitaire1_min_players', 4, 10), ('solitaire2_min_players', 4, 10),
    ('capitaliste_goal', 3, 30), ('opportuniste_switch_cost', 0, 9)
$$;

-- ---------------------------------------------------------------------------
-- Distribution : Saboteurs + Villageois, et 0 à 2 Solitaires selon le nombre de joueurs
-- ---------------------------------------------------------------------------
create or replace function public.start_game(p_room_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_room  public.rooms;
  v_count int;
  v_s     int;
  v_sol   int := 0;
  v_solo  text[];
  v_roles text[];
begin
  select * into v_room from public.rooms where id = p_room_id for update;
  if not found then raise exception 'room_not_found'; end if;

  if not exists (select 1 from public.players
                 where room_id = p_room_id and user_id = auth.uid() and is_host) then
    raise exception 'not_host';
  end if;
  if v_room.status <> 'lobby' then raise exception 'game_started'; end if;

  select count(*) into v_count from public.players where room_id = p_room_id;
  if v_count < 4 then raise exception 'not_enough_players'; end if;

  -- Saboteurs : réglage du salon, sinon 1 jusqu'à 5 joueurs, 2 au-delà
  v_s := case when public.room_param(p_room_id, 'saboteurs_count') > 0
              then least(public.room_param(p_room_id, 'saboteurs_count'), v_count - 1)
              else case when v_count <= 5 then 1 else 2 end end;

  -- Solitaires (option) : 1 à partir de solitaire1_min_players, 2 à partir de solitaire2_min_players
  if public.room_param(p_room_id, 'solitaires_on') = 1 then
    v_sol := case when v_count >= public.room_param(p_room_id, 'solitaire2_min_players') then 2
                  when v_count >= public.room_param(p_room_id, 'solitaire1_min_players') then 1
                  else 0 end;
    v_sol := greatest(0, least(v_sol, v_count - v_s - 1)); -- toujours au moins un Villageois
  end if;

  select coalesce(array_agg(r), '{}'::text[]) into v_solo
  from (select r from unnest(array['capitaliste', 'opportuniste']) as r order by random() limit v_sol) x;

  v_roles := array(select 'saboteur_simple'::text from generate_series(1, v_s))
          || v_solo
          || array(select 'villageois_simple'::text from generate_series(1, v_count - v_s - v_sol));

  if coalesce(array_length(v_roles, 1), 0) <> v_count then
    raise exception 'distribution_error';
  end if;

  insert into public.player_secrets (player_id, role_id, team, tokens)
  select s.id,
         s.role_id,
         public.role_team(s.role_id),
         case when public.role_team(s.role_id) = 'saboteurs'
              then case when v_s = 1 then public.room_param(p_room_id, 'tokens_start_saboteur_solo')
                        else public.room_param(p_room_id, 'tokens_start_saboteur') end
              else public.room_param(p_room_id, 'tokens_start_villager') end
  from (
    select p.id, v_roles[(row_number() over (order by random()))::int] as role_id
    from public.players p
    where p.room_id = p_room_id
  ) s;

  -- Opportuniste bot : parie tout de suite sur un camp au hasard
  update public.player_secrets ps
  set side = case when random() < 0.5 then 'villageois' else 'saboteurs' end
  from public.players p
  where p.id = ps.player_id and p.room_id = p_room_id and p.is_bot and ps.role_id = 'opportuniste';

  update public.rooms
  set status = 'playing',
      round = 1,
      phase = 'night',
      phase_ends_at = now() + make_interval(secs => public.room_phase_seconds(p_room_id, 'night'))
  where id = p_room_id;
end $$;

-- ---------------------------------------------------------------------------
-- Capitaliste : victoire acquise dès qu'il atteint l'objectif (quel que soit le moment)
-- ---------------------------------------------------------------------------
create or replace function public.trg_capitaliste_goal()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.role_id = 'capitaliste' and not new.solo_won then
    if new.tokens >= public.room_param(
         (select room_id from public.players where id = new.player_id), 'capitaliste_goal') then
      new.solo_won := true;
    end if;
  end if;
  return new;
end $$;

drop trigger if exists player_secrets_capitaliste on public.player_secrets;
create trigger player_secrets_capitaliste
before insert or update of tokens on public.player_secrets
for each row execute function public.trg_capitaliste_goal();

-- ---------------------------------------------------------------------------
-- Opportuniste : choisir / changer de camp (la nuit, vivant ; 1er choix gratuit)
-- ---------------------------------------------------------------------------
create or replace function public.set_opportunist_side(p_room_id uuid, p_side text, p_player_id uuid default null)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_room   public.rooms;
  v_player public.players;
  v_sec    public.player_secrets;
begin
  select * into v_room from public.rooms where id = p_room_id for update;
  if not found then raise exception 'room_not_found'; end if;
  v_player := public.resolve_target(p_room_id, p_player_id);

  if v_room.status <> 'playing' or v_room.phase <> 'night' then raise exception 'not_night'; end if;
  if not v_player.is_alive then raise exception 'player_dead'; end if;
  if p_side not in ('villageois', 'saboteurs') then raise exception 'invalid_params'; end if;

  select * into v_sec from public.player_secrets where player_id = v_player.id for update;
  if v_sec.role_id is distinct from 'opportuniste' then raise exception 'not_opportunist'; end if;
  if v_sec.side = p_side then return; end if;

  if v_sec.side is not null
     and not public.spend_tokens(v_player.id, public.room_param(p_room_id, 'opportuniste_switch_cost')) then
    raise exception 'not_enough_tokens';
  end if;

  update public.player_secrets set side = p_side where player_id = v_player.id;
end $$;

-- ---------------------------------------------------------------------------
-- Fin de partie : victoire de l'Opportuniste (en vie et du côté gagnant).
-- Nom choisi pour passer AVANT rooms_record_stats (les triggers AFTER sont lancés par ordre alphabétique).
-- ---------------------------------------------------------------------------
create or replace function public.trg_end_solitaires()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.player_secrets ps
  set solo_won = (p.is_alive and ps.side is not null and ps.side = new.winner)
  from public.players p
  where p.id = ps.player_id and p.room_id = new.id and ps.role_id = 'opportuniste';
  return new;
end $$;

drop trigger if exists rooms_end_solitaires on public.rooms;
create trigger rooms_end_solitaires
after update of phase on public.rooms
for each row
when (new.phase = 'ended' and old.phase is distinct from 'ended')
execute function public.trg_end_solitaires();

-- ---------------------------------------------------------------------------
-- Rôles finaux : avec le résultat des Solitaires
-- ---------------------------------------------------------------------------
create or replace function public.get_final_roles(p_room_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_room public.rooms;
begin
  select * into v_room from public.rooms where id = p_room_id;
  if not found then raise exception 'room_not_found'; end if;
  if not public.is_room_member(p_room_id) then raise exception 'not_member'; end if;
  if v_room.phase <> 'ended' then raise exception 'not_ended'; end if;
  return coalesce((
    select jsonb_agg(jsonb_build_object('player_id', s.player_id, 'role_id', s.role_id, 'team', s.team,
                                        'solo_won', s.solo_won, 'side', s.side))
    from public.player_secrets s
    join public.players p on p.id = s.player_id
    where p.room_id = p_room_id), '[]'::jsonb);
end $$;

revoke all on function public.trg_capitaliste_goal() from public, anon, authenticated;
revoke all on function public.trg_end_solitaires() from public, anon, authenticated;
revoke execute on function public.set_opportunist_side(uuid, text, uuid) from public, anon;
grant execute on function public.set_opportunist_side(uuid, text, uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- Statistiques : la victoire d'un Solitaire est sa victoire personnelle (solo_won)
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
    select pl.id, pl.user_id, pl.nickname, pl.is_alive, s.team, s.role_id, s.solo_won
    from public.players pl
    join public.player_secrets s on s.player_id = pl.id
    where pl.room_id = p_room and not pl.is_bot and pl.user_id is not null
  loop
    v_won := (v_room.winner = 'villageois' and p.team = 'villageois')
          or (v_room.winner = 'saboteurs'  and p.team = 'saboteurs')
          or (p.team = 'solitaires' and p.solo_won);

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
    'solitaires_games',   count(*) filter (where team = 'solitaires'),
    'solitaires_wins',    count(*) filter (where team = 'solitaires' and won),
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

revoke all on function public.record_game_stats(uuid) from public, anon, authenticated;
revoke execute on function public.get_my_stats() from public, anon;
grant execute on function public.get_my_stats() to authenticated;
