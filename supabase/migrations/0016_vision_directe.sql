-- =====================================================
-- BLUFF : les Saboteurs voient aussi la position (non validée) de leurs alliés, en direct
--   Le lieu touché sur la carte est partagé (set_night_draft) avant même la validation ;
--   get_saboteur_vision renvoie le lieu validé, sinon le lieu envisagé, avec un drapeau « validated ».
-- À coller dans Supabase > SQL Editor > New query > Run (après 0015)
-- =====================================================

-- Lieu envisagé (non validé) d'un Saboteur, partagé seulement avec ses alliés (option saboteur_vision)
create table if not exists public.night_drafts (
  room_id   uuid not null references public.rooms(id) on delete cascade,
  round     int  not null,
  player_id uuid not null references public.players(id) on delete cascade,
  location  text not null,
  primary key (room_id, round, player_id)
);
alter table public.night_drafts enable row level security;
revoke all on public.night_drafts from anon, authenticated;

create or replace function public.set_night_draft(p_room_id uuid, p_location text, p_player_id uuid default null)
returns void
language plpgsql security definer set search_path = public as $$
declare
  v_room public.rooms;
  v_me   public.players;
begin
  select * into v_room from public.rooms where id = p_room_id;
  if not found then raise exception 'room_not_found'; end if;
  v_me := public.resolve_target(p_room_id, p_player_id);
  if v_room.status <> 'playing' or v_room.phase <> 'night' or not v_me.is_alive then return; end if;
  if public.room_param(p_room_id, 'saboteur_vision') <> 1
     or not exists (select 1 from public.player_secrets where player_id = v_me.id and team = 'saboteurs') then
    return;
  end if;
  if p_location is null or not exists (select 1 from public.locations where id = p_location) then
    delete from public.night_drafts where room_id = p_room_id and round = v_room.round and player_id = v_me.id;
    return;
  end if;
  insert into public.night_drafts (room_id, round, player_id, location)
  values (p_room_id, v_room.round, v_me.id, p_location)
  on conflict (room_id, round, player_id) do update set location = excluded.location;
end $$;

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
     or v_room.status <> 'playing' or v_room.phase <> 'night'
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
    'haunts', coalesce((select jsonb_agg(jsonb_build_object('ghost_id', h.ghost_id, 'ally_id', h.ally_id))
                        from public.ghost_haunts h
                        where h.room_id = p_room_id and h.round = v_room.round), '[]'::jsonb));
end $$;

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

  delete from public.ghost_watch where room_id = p_room_id;
  delete from public.ghost_haunts where room_id = p_room_id;
  delete from public.night_drafts where room_id = p_room_id;
  delete from public.ghost_hints
  where player_id in (select id from public.players where room_id = p_room_id);
  delete from public.vote_runoffs where room_id = p_room_id;
  delete from public.night_deaths where room_id = p_room_id;
  delete from public.vote_tampering where room_id = p_room_id;
  delete from public.vote_results where room_id = p_room_id;
  delete from public.votes where room_id = p_room_id;
  delete from public.closures where room_id = p_room_id;
  delete from public.night_actions where room_id = p_room_id;
  delete from public.player_secrets
  where player_id in (select id from public.players where room_id = p_room_id);
  update public.players set is_alive = true where room_id = p_room_id;
  update public.rooms
  set status = 'lobby', round = 0, phase = 'lobby', phase_ends_at = null, winner = null,
      vote_step = 0, vote_candidates = null, sudden_death = false
  where id = p_room_id;
end $$;

revoke execute on function public.set_night_draft(uuid, text, uuid) from public, anon;
grant execute on function public.set_night_draft(uuid, text, uuid) to authenticated;
