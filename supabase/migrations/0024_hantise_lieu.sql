-- 0024 : le fantôme Saboteur hante un LIEU, et non plus un allié (lot C des retours de parties tests)
--   - ghost_haunts.location : lieu hanté (hors maison). ally_id devient facultatif (anciennes lignes).
--   - set_ghost_haunt(salon, lieu, joueur) remplace set_ghost_haunt(salon, allié, joueur).
--   - night_kill : +ghost_haunt_bonus_pct par fantôme Saboteur qui hante le lieu, s'il s'y trouve
--     au moins un Saboteur vivant et une cible (sinon pas de meurtre possible de toute façon).
--   - get_saboteur_vision : réservé aux Saboteurs VIVANTS ; le fantôme ne voit plus où vont ses alliés
--     (il doit deviner), et les vivants ne voient plus les hantises (pas de rendez-vous possible).
--   - Fantômes Saboteurs bots : ils hantent un lieu au hasard (hors maison).

-- 1. Table
alter table public.ghost_haunts add column if not exists location text references public.locations(id);
alter table public.ghost_haunts alter column ally_id drop not null;

-- 2. Meurtre : bonus des fantômes qui hantent ce lieu
create or replace function public.night_kill(p_room uuid, p_round int, p_loc text)
returns uuid
language plpgsql security definer set search_path = public as $$
declare
  v_s      int;
  v_v      int;
  v_pct    int;
  v_victim uuid;
  v_h      int;
begin
  if p_loc = 'maison' then return null; end if;
  select count(*) filter (where s.team = 'saboteurs'), count(*) filter (where s.team <> 'saboteurs')
  into v_s, v_v
  from public.night_actions na
  join public.player_secrets s on s.player_id = na.player_id
  join public.players p on p.id = na.player_id and p.is_alive
  where na.room_id = p_room and na.round = p_round and na.location = p_loc;
  if v_s = 0 or v_v = 0 then return null; end if;

  v_pct := case when v_s > v_v then public.room_param(p_room, 'kill_majority_pct')
                when v_s = v_v then public.room_param(p_room, 'kill_tie_pct')
                else public.room_param(p_room, 'kill_minority_pct') end;

  -- fantômes saboteurs qui hantent ce lieu (un Saboteur vivant y est, voir plus haut) : +bonus chacun
  if public.room_param(p_room, 'ghost_haunt_on') = 1 then
    select count(*) into v_h from public.ghost_haunts h
       join public.players g on g.id = h.ghost_id and not g.is_alive
       join public.player_secrets gs on gs.player_id = h.ghost_id and gs.team = 'saboteurs'
       where h.room_id = p_room and h.round = p_round and h.location = p_loc;
    v_pct := least(100, v_pct + v_h * public.room_param(p_room, 'ghost_haunt_bonus_pct'));
  end if;

  if random() * 100 >= v_pct then return null; end if;

  select na.player_id into v_victim
  from public.night_actions na
  join public.player_secrets s on s.player_id = na.player_id
  join public.players p on p.id = na.player_id and p.is_alive
  where na.room_id = p_room and na.round = p_round and na.location = p_loc and s.team <> 'saboteurs'
  order by random() limit 1;

  update public.players set is_alive = false where id = v_victim;
  insert into public.night_deaths (room_id, round, victim_id, location) values (p_room, p_round, v_victim, p_loc);
  return v_victim;
end $$;

-- 3. Fantômes Saboteurs bots (dans resolve_night) : un lieu au hasard au lieu d'un allié.
--    On remplace ce passage dans la définition actuelle, sans recopier la longue fonction.
do $$
declare
  def text := replace(pg_get_functiondef('public.resolve_night(uuid)'::regprocedure), E'\r\n', E'\n');
  old text := $old$    insert into public.ghost_haunts (room_id, round, ghost_id, ally_id)
    select p_room_id, v_round, g.id,
           (select al.id from public.players al join public.player_secrets als on als.player_id = al.id
            where al.room_id = p_room_id and al.is_alive and als.team = 'saboteurs' order by random() limit 1)$old$;
  new text := $new$    insert into public.ghost_haunts (room_id, round, ghost_id, location)
    select p_room_id, v_round, g.id,
           (select l.id from public.locations l where l.id <> 'maison' order by random() limit 1)$new$;
begin
  if position(old in def) = 0 then raise exception 'hantise des bots introuvable dans resolve_night'; end if;
  execute replace(def, old, new);
end $$;

-- 4. Choix du lieu hanté (fantôme Saboteur, la nuit) ; null = ne hanter nulle part
drop function if exists public.set_ghost_haunt(uuid, uuid, uuid);
create or replace function public.set_ghost_haunt(p_room_id uuid, p_location text, p_player_id uuid default null)
returns void
language plpgsql security definer set search_path = public as $$
declare
  v_room  public.rooms;
  v_ghost public.players;
begin
  select * into v_room from public.rooms where id = p_room_id for update;
  if not found then raise exception 'room_not_found'; end if;
  v_ghost := public.resolve_target(p_room_id, p_player_id);
  if v_room.status <> 'playing' or v_room.phase <> 'night' then raise exception 'not_night'; end if;
  if v_ghost.is_alive then raise exception 'not_ghost'; end if;
  if public.room_param(p_room_id, 'ghost_haunt_on') <> 1 then raise exception 'invalid_params'; end if;
  if not exists (select 1 from public.player_secrets where player_id = v_ghost.id and team = 'saboteurs') then
    raise exception 'not_saboteur';
  end if;
  if p_location is null then
    delete from public.ghost_haunts where room_id = p_room_id and round = v_room.round and ghost_id = v_ghost.id;
    return;
  end if;
  if p_location = 'maison' or not exists (select 1 from public.locations where id = p_location) then
    raise exception 'invalid_location';
  end if;
  insert into public.ghost_haunts (room_id, round, ghost_id, location)
  values (p_room_id, v_room.round, v_ghost.id, p_location)
  on conflict (room_id, round, ghost_id) do update set location = excluded.location, ally_id = null;
end $$;

-- 5. Rapport du fantôme : « haunt » = lieu hanté cette nuit
create or replace function public.get_ghost_report(p_room_id uuid, p_player_id uuid default null)
returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  v_ghost public.players;
begin
  v_ghost := public.resolve_target(p_room_id, p_player_id);
  if v_ghost.is_alive then
    return jsonb_build_object('ghost', false, 'watches', '[]'::jsonb, 'suspect', null);
  end if;
  return jsonb_build_object(
    'ghost', true,
    'watches', coalesce((select jsonb_agg(jsonb_build_object(
                           'round', w.round, 'target_id', w.target_id, 'location', w.location)
                         order by w.round)
                         from public.ghost_watch w
                         where w.room_id = p_room_id and w.ghost_id = v_ghost.id), '[]'::jsonb),
    'suspect', (select h.suspect_id from public.ghost_hints h where h.player_id = v_ghost.id),
    'tomb', (select h.tomb from public.ghost_hints h where h.player_id = v_ghost.id),
    'haunt', (select h.location from public.ghost_haunts h join public.rooms r on r.id = h.room_id
              where h.room_id = p_room_id and h.round = r.round and h.ghost_id = v_ghost.id));
end $$;

-- 6. Vision : Saboteurs vivants seulement, sans les hantises
create or replace function public.get_saboteur_vision(p_room_id uuid, p_player_id uuid default null)
returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  v_room public.rooms;
  v_me   public.players;
begin
  select * into v_room from public.rooms where id = p_room_id;
  if not found then raise exception 'room_not_found'; end if;
  v_me := public.resolve_target(p_room_id, p_player_id);
  if public.room_param(p_room_id, 'saboteur_vision') <> 1
     or v_room.status <> 'playing' or v_room.phase <> 'night' or not v_me.is_alive
     or not exists (select 1 from public.player_secrets where player_id = v_me.id and team = 'saboteurs') then
    return jsonb_build_object('allies', '[]'::jsonb, 'haunts', '[]'::jsonb);
  end if;
  return jsonb_build_object(
    'allies', coalesce((select jsonb_agg(jsonb_build_object('player_id', p.id,
                                'location', coalesce(na.location, d.location), 'validated', na.location is not null) order by p.id)
                        from public.players p
                        join public.player_secrets s on s.player_id = p.id and s.team = 'saboteurs'
                        left join public.night_actions na on na.room_id = p_room_id and na.round = v_room.round and na.player_id = p.id
                        left join public.night_drafts d on d.room_id = p_room_id and d.round = v_room.round and d.player_id = p.id
                        where p.room_id = p_room_id and p.is_alive and p.id <> v_me.id), '[]'::jsonb),
    'haunts', '[]'::jsonb);
end $$;

-- 7. Droits (règle de la revue 0020)
revoke all on function public.night_kill(uuid, int, text), public.resolve_night(uuid) from public, anon, authenticated;
revoke all on function public.set_ghost_haunt(uuid, text, uuid), public.get_ghost_report(uuid, uuid),
  public.get_saboteur_vision(uuid, uuid) from public, anon;
grant execute on function public.set_ghost_haunt(uuid, text, uuid), public.get_ghost_report(uuid, uuid),
  public.get_saboteur_vision(uuid, uuid) to authenticated;
