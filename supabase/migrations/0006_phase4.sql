-- =====================================================
-- BLUFF : phase 4 (vote, élimination, victoire)
--   Déroulé d'une manche : nuit > jour (débat) > vote > résultat > nuit suivante
--   Vote secret ; le plus voté est éliminé (son équipe est révélée) ; égalité = personne.
--   Victoire : Villageois si plus aucun Saboteur ; Saboteurs s'ils sont au moins
--   aussi nombreux que les autres joueurs vivants.
-- À coller dans Supabase > SQL Editor > New query > Run
-- =====================================================

-- 1. Nouvelles phases et vainqueur
alter table public.rooms drop constraint if exists rooms_phase_check;
alter table public.rooms add constraint rooms_phase_check
  check (phase in ('lobby', 'night', 'day', 'vote', 'result', 'ended'));
alter table public.rooms add column winner text check (winner in ('villageois', 'saboteurs'));

-- 2. Votes (secrets) et résultats (publics)
create table public.votes (
  room_id    uuid not null references public.rooms(id) on delete cascade,
  round      int  not null,
  voter_id   uuid not null references public.players(id) on delete cascade,
  target_id  uuid references public.players(id) on delete cascade,   -- null = abstention
  created_at timestamptz not null default now(),
  primary key (room_id, round, voter_id)
);
alter table public.votes enable row level security;
revoke insert, update, delete on public.votes from anon, authenticated;

create policy "chacun lit son propre vote" on public.votes
  for select to authenticated using (
    exists (select 1 from public.players p where p.id = voter_id and p.user_id = auth.uid())
  );

create policy "hote debug lit les votes des bots" on public.votes
  for select to authenticated using (
    exists (
      select 1
      from public.players bot
      join public.rooms r   on r.id = bot.room_id
      join public.players h on h.room_id = bot.room_id
      where bot.id = votes.voter_id
        and bot.is_bot and r.debug
        and h.user_id = auth.uid() and h.is_host
    )
  );

create table public.vote_results (
  room_id         uuid not null references public.rooms(id) on delete cascade,
  round           int  not null,
  eliminated_id   uuid references public.players(id) on delete cascade,  -- null = égalité ou aucun vote
  eliminated_team text,
  tied            boolean not null default false,
  tally           jsonb not null default '{}'::jsonb,   -- { joueur : nombre de voix }, sans les votants
  primary key (room_id, round)
);
alter table public.vote_results enable row level security;
revoke insert, update, delete on public.vote_results from anon, authenticated;
create policy "membres lisent les resultats" on public.vote_results
  for select to authenticated using (public.is_room_member(room_id));

-- 3. Conditions de victoire
create or replace function public.check_victory(p_room_id uuid)
returns text
language sql security definer set search_path = public as $$
  select case
    when x.s = 0 then 'villageois'
    when x.s >= x.o then 'saboteurs'
    else null
  end
  from (
    select count(*) filter (where ps.team = 'saboteurs') as s,
           count(*) filter (where ps.team <> 'saboteurs') as o
    from public.players p
    join public.player_secrets ps on ps.player_id = p.id
    where p.room_id = p_room_id and p.is_alive
  ) x;
$$;

-- 4. Voter (secret) ; p_target null = s'abstenir ; l'hôte debug peut voter pour un bot
create or replace function public.submit_vote(
  p_room_id uuid, p_target uuid default null, p_player_id uuid default null)
returns void
language plpgsql security definer set search_path = public as $$
declare
  v_room  public.rooms;
  v_voter public.players;
begin
  select * into v_room from public.rooms where id = p_room_id for update;
  if not found then raise exception 'room_not_found'; end if;

  v_voter := public.resolve_target(p_room_id, p_player_id);

  if v_room.status <> 'playing' or v_room.phase <> 'vote' then raise exception 'not_vote'; end if;
  if not v_voter.is_alive then raise exception 'player_dead'; end if;

  if p_target is not null then
    if p_target = v_voter.id
       or not exists (select 1 from public.players
                      where id = p_target and room_id = p_room_id and is_alive) then
      raise exception 'invalid_target';
    end if;
  end if;

  insert into public.votes (room_id, round, voter_id, target_id)
  values (p_room_id, v_room.round, v_voter.id, p_target)
  on conflict (room_id, round, voter_id)
  do update set target_id = excluded.target_id, created_at = now();
end $$;

-- 5. Dépouillement : élimination éventuelle, puis résultat ou fin de partie
create or replace function public.resolve_vote(p_room_id uuid)
returns void
language plpgsql security definer set search_path = public as $$
declare
  v_round  int;
  r        record;
  v_max    int;
  v_n_top  int;
  v_elim   uuid;
  v_team   text;
  v_tally  jsonb;
  v_win    text;
begin
  select round into v_round from public.rooms where id = p_room_id;

  -- Joueurs sans vote : les bots votent au hasard, les humains s'abstiennent
  for r in
    select p.id, p.is_bot
    from public.players p
    where p.room_id = p_room_id and p.is_alive
      and not exists (select 1 from public.votes v
                      where v.room_id = p_room_id and v.round = v_round and v.voter_id = p.id)
  loop
    insert into public.votes (room_id, round, voter_id, target_id)
    values (p_room_id, v_round, r.id,
            case when r.is_bot
                 then (select p2.id from public.players p2
                       where p2.room_id = p_room_id and p2.is_alive and p2.id <> r.id
                       order by random() limit 1)
                 else null end);
  end loop;

  select coalesce(jsonb_object_agg(t.target_id, t.c), '{}'::jsonb) into v_tally
  from (select target_id, count(*) as c from public.votes
        where room_id = p_room_id and round = v_round and target_id is not null
        group by target_id) t;

  select max(c) into v_max
  from (select count(*) as c from public.votes
        where room_id = p_room_id and round = v_round and target_id is not null
        group by target_id) t;

  if v_max is not null then
    select count(*) into v_n_top
    from (select count(*) as c from public.votes
          where room_id = p_room_id and round = v_round and target_id is not null
          group by target_id having count(*) = v_max) t;
    if v_n_top = 1 then
      select target_id into v_elim
      from public.votes
      where room_id = p_room_id and round = v_round and target_id is not null
      group by target_id having count(*) = v_max;
    end if;
  end if;

  if v_elim is not null then
    update public.players set is_alive = false where id = v_elim;
    select team into v_team from public.player_secrets where player_id = v_elim;
  end if;

  insert into public.vote_results (room_id, round, eliminated_id, eliminated_team, tied, tally)
  values (p_room_id, v_round, v_elim, v_team, (v_max is not null and v_elim is null), v_tally);

  v_win := public.check_victory(p_room_id);

  update public.rooms
  set phase = case when v_win is null then 'result' else 'ended' end,
      winner = v_win,
      phase_ends_at = null
  where id = p_room_id;
end $$;

-- 6. Passage à la phase suivante : nuit > jour > vote > résultat > nuit (par l'hôte, ou minuteur si timers_on = 1)
create or replace function public.advance_phase(p_room_id uuid, p_force boolean default false)
returns void
language plpgsql security definer set search_path = public as $$
declare
  v_room public.rooms;
  v_me   public.players;
  v_due  boolean;
begin
  select * into v_room from public.rooms where id = p_room_id for update;
  if not found then return; end if;

  select * into v_me from public.players where room_id = p_room_id and user_id = auth.uid();
  if not found then raise exception 'not_member'; end if;
  if p_force and not v_me.is_host then raise exception 'not_host'; end if;

  if v_room.status <> 'playing' then return; end if;

  v_due := coalesce(
    p_force
    or (public.game_param('timers_on') = 1 and v_room.phase_ends_at <= now()),
    false);
  if not v_due then return; end if;

  if v_room.phase = 'night' then
    perform public.resolve_night(p_room_id);
  elsif v_room.phase = 'day' then
    update public.rooms
    set phase = 'vote', phase_ends_at = now() + make_interval(secs => public.phase_seconds('vote'))
    where id = p_room_id;
  elsif v_room.phase = 'vote' then
    perform public.resolve_vote(p_room_id);
  elsif v_room.phase = 'result' then
    perform public.start_night(p_room_id);
  end if;
end $$;

-- 7. Progression du vote (compteur, aucun secret)
create or replace function public.vote_progress(p_room_id uuid)
returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  v_room public.rooms;
begin
  select * into v_room from public.rooms where id = p_room_id;
  if not found then raise exception 'room_not_found'; end if;
  if not public.is_room_member(p_room_id) then raise exception 'not_member'; end if;
  return jsonb_build_object(
    'played', (select count(*) from public.votes v
               join public.players p on p.id = v.voter_id
               where v.room_id = p_room_id and v.round = v_room.round and p.is_alive),
    'total', (select count(*) from public.players where room_id = p_room_id and is_alive));
end $$;

-- 8. Révélation finale : tous les rôles, une fois la partie terminée
create or replace function public.get_final_roles(p_room_id uuid)
returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  v_room public.rooms;
begin
  select * into v_room from public.rooms where id = p_room_id;
  if not found then raise exception 'room_not_found'; end if;
  if not public.is_room_member(p_room_id) then raise exception 'not_member'; end if;
  if v_room.phase <> 'ended' then raise exception 'not_ended'; end if;
  return coalesce((
    select jsonb_agg(jsonb_build_object('player_id', s.player_id, 'role_id', s.role_id, 'team', s.team))
    from public.player_secrets s
    join public.players p on p.id = s.player_id
    where p.room_id = p_room_id), '[]'::jsonb);
end $$;

-- 9. Retour au salon : on efface aussi votes, résultats et vainqueur
create or replace function public.reset_room(p_room_id uuid)
returns void
language plpgsql security definer set search_path = public as $$
begin
  perform 1 from public.rooms where id = p_room_id for update;
  if not found then raise exception 'room_not_found'; end if;

  if not exists (select 1 from public.players
                 where room_id = p_room_id and user_id = auth.uid() and is_host) then
    raise exception 'not_host';
  end if;

  delete from public.vote_results where room_id = p_room_id;
  delete from public.votes where room_id = p_room_id;
  delete from public.closures where room_id = p_room_id;
  delete from public.night_actions where room_id = p_room_id;
  delete from public.player_secrets
  where player_id in (select id from public.players where room_id = p_room_id);
  update public.players set is_alive = true where room_id = p_room_id;
  update public.rooms
  set status = 'lobby', round = 0, phase = 'lobby', phase_ends_at = null, winner = null
  where id = p_room_id;
end $$;

-- 10. Droits d'exécution
revoke execute on function public.check_victory(uuid), public.resolve_vote(uuid)
from public, anon, authenticated;

revoke execute on function
  public.submit_vote(uuid, uuid, uuid),
  public.vote_progress(uuid),
  public.get_final_roles(uuid)
from public, anon;
grant execute on function
  public.submit_vote(uuid, uuid, uuid),
  public.vote_progress(uuid),
  public.get_final_roles(uuid)
to authenticated;
