-- 0019 : données d'équilibrage
-- Chaque partie terminée (hors debug) garde désormais : début, nombre de Saboteurs et de Solitaires,
-- façon dont elle s'est terminée (à l'aube ou au vote), résultats des Solitaires et réglages du salon.
-- get_balance_stats() agrège toutes les parties (données anonymes : aucun pseudo, aucun identifiant).

-- ---------------------------------------------------------------------------
-- Heure de début de partie
-- ---------------------------------------------------------------------------
alter table public.rooms add column if not exists started_at timestamptz;

create or replace function public.trg_rooms_started_at()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.status = 'playing' and old.status is distinct from 'playing' then
    new.started_at := now();
  end if;
  return new;
end $$;

drop trigger if exists rooms_started_at on public.rooms;
create trigger rooms_started_at
before update of status on public.rooms
for each row execute function public.trg_rooms_started_at();

revoke all on function public.trg_rooms_started_at() from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- Historique enrichi
-- ---------------------------------------------------------------------------
alter table public.game_history add column if not exists started_at timestamptz;
alter table public.game_history add column if not exists saboteurs  int;
alter table public.game_history add column if not exists solitaires int;
alter table public.game_history add column if not exists ended_by   text check (ended_by in ('nuit', 'vote'));
alter table public.game_history add column if not exists solo       jsonb not null default '[]'::jsonb; -- [{role, won}]
alter table public.game_history add column if not exists settings   jsonb not null default '{}'::jsonb; -- réglages modifiés du salon

-- record_game_stats : on remplace seulement l'insertion dans game_history (le reste est inchangé)
do $mig$
declare
  d text;
  n text;
begin
  d := pg_get_functiondef('public.record_game_stats(uuid)'::regprocedure);
  n := replace(d,
$q$  insert into public.game_history (room_id, room_code, winner, rounds, player_count)
  values (p_room, v_room.code, v_room.winner, v_room.round,
          (select count(*) from public.players where room_id = p_room))
  returning id into v_game;$q$,
$q$  insert into public.game_history (room_id, room_code, winner, rounds, player_count,
                                   started_at, saboteurs, solitaires, ended_by, solo, settings)
  values (p_room, v_room.code, v_room.winner, v_room.round,
          (select count(*) from public.players where room_id = p_room),
          v_room.started_at,
          v_nsab,
          (select count(*) from public.players pl join public.player_secrets s on s.player_id = pl.id
            where pl.room_id = p_room and s.team = 'solitaires'),
          case when exists (select 1 from public.vote_results vr where vr.room_id = p_room and vr.round = v_room.round)
               then 'vote' else 'nuit' end,
          coalesce((select jsonb_agg(jsonb_build_object('role', s.role_id, 'won', s.solo_won))
                    from public.players pl join public.player_secrets s on s.player_id = pl.id
                    where pl.room_id = p_room and s.team = 'solitaires'), '[]'::jsonb),
          coalesce((select vals from public.room_settings where room_id = p_room), '{}'::jsonb))
  returning id into v_game;$q$);
  if n = d then raise exception 'record_game_stats : insertion game_history introuvable'; end if;
  execute n;
end $mig$;

revoke all on function public.record_game_stats(uuid) from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- Statistiques d'équilibrage (toutes les parties, anonymes)
-- ---------------------------------------------------------------------------
create or replace function public.get_balance_stats()
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  if auth.uid() is null then raise exception 'not_authenticated'; end if;

  return jsonb_build_object(
    'games', (select count(*) from public.game_history),
    'villageois', (select count(*) from public.game_history where winner = 'villageois'),
    'saboteurs',  (select count(*) from public.game_history where winner = 'saboteurs'),
    'ended_nuit', (select count(*) from public.game_history where ended_by = 'nuit'),
    'ended_vote', (select count(*) from public.game_history where ended_by = 'vote'),
    'avg_rounds', (select round(avg(rounds)::numeric, 1) from public.game_history),
    'avg_minutes', (select round(avg(extract(epoch from ended_at - started_at) / 60)::numeric, 0)
                    from public.game_history where started_at is not null),
    'by_players', coalesce((
      select jsonb_agg(x order by (x->>'players')::int) from (
        select jsonb_build_object(
          'players', player_count,
          'games', count(*),
          'villageois', count(*) filter (where winner = 'villageois'),
          'saboteurs', count(*) filter (where winner = 'saboteurs'),
          'avg_rounds', round(avg(rounds)::numeric, 1),
          'avg_minutes', round(avg(extract(epoch from ended_at - started_at) / 60)
                               filter (where started_at is not null)::numeric, 0)) as x
        from public.game_history group by player_count) t), '[]'::jsonb),
    'solitaires', coalesce((
      select jsonb_object_agg(role, jsonb_build_object('games', n, 'wins', w)) from (
        select e->>'role' as role, count(*) as n, count(*) filter (where (e->>'won')::boolean) as w
        from public.game_history g, jsonb_array_elements(g.solo) e
        group by e->>'role') t), '{}'::jsonb),
    'recent', coalesce((
      select jsonb_agg(x order by x->>'ended_at' desc) from (
        select jsonb_build_object(
          'ended_at', ended_at, 'players', player_count, 'saboteurs', saboteurs, 'solitaires', solitaires,
          'rounds', rounds, 'minutes', round(extract(epoch from ended_at - started_at) / 60),
          'winner', winner, 'ended_by', ended_by, 'solo', solo, 'settings', settings) as x
        from public.game_history order by ended_at desc limit 30) t), '[]'::jsonb)
  );
end $$;

revoke execute on function public.get_balance_stats() from public, anon;
grant execute on function public.get_balance_stats() to authenticated;
