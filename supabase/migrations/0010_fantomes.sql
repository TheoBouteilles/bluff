-- =====================================================
-- BLUFF : étape 2 des fantômes
--   Un joueur mort (tué ou éliminé au vote) est un fantôme. Il ne joue ni ne vote plus, mais :
--   * chaque nuit, il choisit un joueur vivant à observer : à l'aube il apprend où ce joueur
--     a passé la nuit (gratuit) ;
--   * il peut désigner à tout moment un « suspect » (un nom de méchant probable) et le changer
--     quand il veut. Ce suspect servira d'indice au Cimetière (étape 3). Un fantôme Saboteur
--     peut mentir : rien n'oblige le suspect à être un vrai méchant.
--   * les fantômes-bots observent et désignent un suspect au hasard.
-- À coller dans Supabase > SQL Editor > New query > Run (après 0009)
-- =====================================================

-- 1. Observations des fantômes (secrètes : lues uniquement via get_ghost_report)
create table public.ghost_watch (
  room_id   uuid not null references public.rooms(id) on delete cascade,
  round     int  not null,
  ghost_id  uuid not null references public.players(id) on delete cascade,
  target_id uuid not null references public.players(id) on delete cascade,
  location  text,                       -- rempli à la résolution de la nuit
  primary key (room_id, round, ghost_id)
);
alter table public.ghost_watch enable row level security;
revoke all on public.ghost_watch from anon, authenticated;

-- 2. Suspect désigné par chaque fantôme
create table public.ghost_hints (
  player_id     uuid primary key references public.players(id) on delete cascade,
  suspect_id    uuid references public.players(id) on delete set null,
  updated_round int not null default 0
);
alter table public.ghost_hints enable row level security;
revoke all on public.ghost_hints from anon, authenticated;

-- 3. Choisir qui observer cette nuit (fantôme ; l'hôte debug peut le faire pour un bot)
create or replace function public.submit_ghost_watch(
  p_room_id uuid, p_target uuid, p_player_id uuid default null)
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
  if p_target is null or p_target = v_ghost.id
     or not exists (select 1 from public.players
                    where id = p_target and room_id = p_room_id and is_alive) then
    raise exception 'invalid_target';
  end if;

  insert into public.ghost_watch (room_id, round, ghost_id, target_id)
  values (p_room_id, v_room.round, v_ghost.id, p_target)
  on conflict (room_id, round, ghost_id) do update set target_id = excluded.target_id, location = null;
end $$;

-- 4. Désigner (ou effacer avec null) son suspect
create or replace function public.set_ghost_hint(
  p_room_id uuid, p_suspect uuid, p_player_id uuid default null)
returns void
language plpgsql security definer set search_path = public as $$
declare
  v_room  public.rooms;
  v_ghost public.players;
begin
  select * into v_room from public.rooms where id = p_room_id;
  if not found then raise exception 'room_not_found'; end if;
  v_ghost := public.resolve_target(p_room_id, p_player_id);

  if v_room.status <> 'playing' then raise exception 'not_playing'; end if;
  if v_ghost.is_alive then raise exception 'not_ghost'; end if;
  if p_suspect is not null and (p_suspect = v_ghost.id
     or not exists (select 1 from public.players where id = p_suspect and room_id = p_room_id)) then
    raise exception 'invalid_target';
  end if;

  insert into public.ghost_hints (player_id, suspect_id, updated_round)
  values (v_ghost.id, p_suspect, v_room.round)
  on conflict (player_id) do update set suspect_id = excluded.suspect_id, updated_round = excluded.updated_round;
end $$;

-- 5. Ce que sait un fantôme : ses observations (avec le lieu une fois la nuit passée) et son suspect
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
    'suspect', (select h.suspect_id from public.ghost_hints h where h.player_id = v_ghost.id));
end $$;

-- 6. Résolution de la nuit (+ vision des fantômes)
create or replace function public.resolve_night(p_room_id uuid)
returns void
language plpgsql security definer set search_path = public as $$
declare
  v_round   int;
  r         record;
  a         record;
  v_stake   int;
  v_cost    int;
  v_win     boolean;
  v_target  uuid;
  v_targets uuid[];
  v_has     boolean;
  v_loc     text;
  v_sab     text;
  v_ok      boolean;
  v_present boolean;
  v_rig     text;
  v_n       int;
  k         record;
  v_victim  uuid;
  v_kill    boolean;
  v_win_t   text;
begin
  select round into v_round from public.rooms where id = p_room_id;

  -- 1. Joueurs sans choix : bots au hasard (parmi les lieux ouverts), humains chez eux
  for r in
    select p.id, p.is_bot
    from public.players p
    where p.room_id = p_room_id and p.is_alive
      and not exists (select 1 from public.night_actions na
                      where na.room_id = p_room_id and na.round = v_round and na.player_id = p.id)
  loop
    insert into public.night_actions (room_id, round, player_id, location)
    values (p_room_id, v_round, r.id,
            case when r.is_bot
                 then (select l.id from public.locations l
                       where not exists (select 1 from public.closures c
                                         where c.room_id = p_room_id and c.round = v_round and c.location = l.id)
                         and not (l.id = 'maison' and exists (
                                    select 1 from public.night_actions pn
                                    where pn.room_id = p_room_id and pn.round = v_round - 1
                                      and pn.player_id = r.id and pn.location = 'maison'))
                       order by random() limit 1)
                 else 'maison' end);
  end loop;

  -- 1b. Fantômes-bots sans choix : ils observent un joueur au hasard et désignent un suspect s'ils n'en ont pas
  insert into public.ghost_watch (room_id, round, ghost_id, target_id)
  select p_room_id, v_round, g.id,
         (select p2.id from public.players p2
          where p2.room_id = p_room_id and p2.is_alive order by random() limit 1)
  from public.players g
  where g.room_id = p_room_id and not g.is_alive and g.is_bot
    and not exists (select 1 from public.ghost_watch w
                    where w.room_id = p_room_id and w.round = v_round and w.ghost_id = g.id)
    and exists (select 1 from public.players p3 where p3.room_id = p_room_id and p3.is_alive);

  insert into public.ghost_hints (player_id, suspect_id, updated_round)
  select g.id,
         (select p2.id from public.players p2
          where p2.room_id = p_room_id and p2.is_alive order by random() limit 1),
         v_round
  from public.players g
  where g.room_id = p_room_id and not g.is_alive and g.is_bot
    and not exists (select 1 from public.ghost_hints h where h.player_id = g.id)
    and exists (select 1 from public.players p3 where p3.room_id = p_room_id and p3.is_alive);

  -- 2. Effets des lieux
  for a in
    select na.player_id, na.location, na.params
    from public.night_actions na
    where na.room_id = p_room_id and na.round = v_round
    order by na.created_at, na.player_id
  loop
    if a.location = 'casino' then
      v_stake := coalesce(public.try_int(a.params->>'stake'), 0);
      if v_stake > 0 then
        if public.spend_tokens(a.player_id, v_stake) then
          v_win := random() * 100 < public.room_param(p_room_id, 'casino_win_pct');
          if v_win then
            update public.player_secrets set tokens = tokens + 2 * v_stake where player_id = a.player_id;
          end if;
          perform public.add_night_result(p_room_id, v_round, a.player_id,
            jsonb_build_object('casino', jsonb_build_object('stake', v_stake, 'won', v_win)));
        end if;
      end if;

    elsif a.location = 'taverne' then
      if a.params->>'action' = 'don' then
        v_target := public.try_uuid(a.params->>'target');
        v_cost := public.room_param(p_room_id, 'don_cost');
        -- le receveur doit être présent à la Taverne
        v_present := exists (select 1 from public.night_actions na
                             where na.room_id = p_room_id and na.round = v_round
                               and na.player_id = v_target and na.location = 'taverne');
        if not v_present then
          perform public.add_night_result(p_room_id, v_round, a.player_id,
            jsonb_build_object('don', jsonb_build_object('target', v_target, 'amount', 0, 'ok', false)));
        elsif public.spend_tokens(a.player_id, v_cost) then
          update public.player_secrets set tokens = tokens + v_cost where player_id = v_target;
          perform public.add_night_result(p_room_id, v_round, a.player_id,
            jsonb_build_object('don', jsonb_build_object('target', v_target, 'amount', v_cost, 'ok', true)));
          update public.night_actions
          set result = result || jsonb_build_object(
            'gifts_received', coalesce((result->>'gifts_received')::int, 0) + v_cost)
          where room_id = p_room_id and round = v_round and player_id = v_target;
        end if;

      elsif a.params->>'action' = 'rumeur' then
        select array_agg(public.try_uuid(e)) into v_targets
        from jsonb_array_elements_text(a.params->'targets') e;
        v_cost := case when cardinality(v_targets) = 3
                       then public.room_param(p_room_id, 'rumeur3_cost') else public.room_param(p_room_id, 'rumeur2_cost') end;
        if public.spend_tokens(a.player_id, v_cost) then
          -- le Caméléon passe pour un innocent
          v_has := exists (select 1 from public.player_secrets
                           where player_id = any(v_targets) and team = 'saboteurs' and role_id <> 'cameleon');
          perform public.add_night_result(p_room_id, v_round, a.player_id,
            jsonb_build_object('rumeur', jsonb_build_object('targets', to_jsonb(v_targets), 'has_saboteur', v_has)));
        end if;
      end if;

    elsif a.location = 'poste_garde' then
      v_target := public.try_uuid(a.params->>'target');
      if v_target is not null and public.spend_tokens(a.player_id, public.room_param(p_room_id, 'poste_garde_cost')) then
        select na.location into v_loc from public.night_actions na
        where na.room_id = p_room_id and na.round = v_round and na.player_id = v_target;
        perform public.add_night_result(p_room_id, v_round, a.player_id,
          jsonb_build_object('observation', jsonb_build_object('target', v_target, 'location', v_loc)));
      end if;

    elsif a.location = 'planque' then
      v_sab := a.params->>'sabotage';
      if v_sab is not null and public.spend_tokens(a.player_id, public.room_param(p_room_id, 'planque_cost')) then
        -- le sabotage rate si un joueur hors Saboteurs se trouve aussi à la Planque
        v_ok := not exists (
          select 1
          from public.night_actions na
          join public.player_secrets s on s.player_id = na.player_id
          where na.room_id = p_room_id and na.round = v_round
            and na.location = 'planque' and s.team <> 'saboteurs');
        if v_ok then
          insert into public.closures (room_id, round, location)
          values (p_room_id, v_round + 1, v_sab)
          on conflict do nothing;
        end if;
        perform public.add_night_result(p_room_id, v_round, a.player_id,
          jsonb_build_object('sabotage', jsonb_build_object('location', v_sab, 'success', v_ok)));
      end if;

    elsif a.location = 'mairie' then
      v_rig := a.params->>'rig';
      select count(*) into v_n from public.night_actions na
      where na.room_id = p_room_id and na.round = v_round and na.location = 'mairie';
      if v_rig is not null then
        if public.spend_tokens(a.player_id, public.room_param(p_room_id, 'mairie_cost')) then
          if v_n >= 2 then
            -- plusieurs joueurs à la Mairie : le trucage échoue, jetons perdus
            perform public.add_night_result(p_room_id, v_round, a.player_id,
              jsonb_build_object('mairie', jsonb_build_object('attempted', true, 'success', false, 'crowded', true)));
          else
            insert into public.vote_tampering (room_id, round, player_id, kind, target_id)
            values (p_room_id, v_round, a.player_id, v_rig, public.try_uuid(a.params->>'target'));
            perform public.add_night_result(p_room_id, v_round, a.player_id,
              jsonb_build_object('mairie', jsonb_build_object(
                'attempted', true, 'success', true, 'rig', v_rig, 'target', public.try_uuid(a.params->>'target'))));
          end if;
        end if;
      elsif v_n >= 2 and exists (select 1 from public.night_actions na
                                 where na.room_id = p_room_id and na.round = v_round
                                   and na.location = 'mairie' and na.params ? 'rig') then
        -- un autre joueur a tenté de truquer : on l'apprend aussi
        perform public.add_night_result(p_room_id, v_round, a.player_id,
          jsonb_build_object('mairie', jsonb_build_object('attempted', false, 'success', false, 'crowded', true)));
      end if;
    end if;
  end loop;

  -- 3. Meurtres : au plus un mort par lieu (hors maison).
  --    Saboteurs > Villageois : un Villageois meurt à coup sûr ; égalité : kill_tie_pct % ; sinon rien.
  for k in
    select na.location,
           count(*) filter (where s.team = 'saboteurs')  as nb_s,
           count(*) filter (where s.team <> 'saboteurs') as nb_v
    from public.night_actions na
    join public.player_secrets s on s.player_id = na.player_id
    where na.room_id = p_room_id and na.round = v_round and na.location <> 'maison'
    group by na.location
    order by na.location
  loop
    if k.nb_s > 0 and k.nb_v > 0 then
      v_kill := random() * 100 < case
                  when k.nb_s > k.nb_v then public.room_param(p_room_id, 'kill_majority_pct')
                  when k.nb_s = k.nb_v then public.room_param(p_room_id, 'kill_tie_pct')
                  else public.room_param(p_room_id, 'kill_minority_pct') end;
      if v_kill then
        select na.player_id into v_victim
        from public.night_actions na
        join public.player_secrets s on s.player_id = na.player_id
        where na.room_id = p_room_id and na.round = v_round and na.location = k.location
          and s.team <> 'saboteurs'
        order by random() limit 1;

        update public.players set is_alive = false where id = v_victim;
        insert into public.night_deaths (room_id, round, victim_id, location)
        values (p_room_id, v_round, v_victim, k.location);
      end if;
    end if;
  end loop;

  -- 3b. Vision des fantômes : où chaque joueur observé a-t-il passé la nuit ?
  update public.ghost_watch w
  set location = (select na.location from public.night_actions na
                  where na.room_id = p_room_id and na.round = v_round and na.player_id = w.target_id)
  where w.room_id = p_room_id and w.round = v_round;

  -- 4. Victoire éventuelle dès l'aube (les Saboteurs peuvent gagner par les meurtres)
  v_win_t := public.check_victory(p_room_id);

  update public.rooms
  set phase = case when v_win_t is null then 'day' else 'ended' end,
      winner = v_win_t,
      phase_ends_at = case when v_win_t is null
                           then now() + make_interval(secs => public.phase_seconds('day'))
                           else null end
  where id = p_room_id;
end $$;

-- 7. Retour au salon
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
      vote_step = 0, vote_candidates = null
  where id = p_room_id;
end $$;

-- 8. Droits d'exécution
revoke execute on function
  public.submit_ghost_watch(uuid, uuid, uuid),
  public.set_ghost_hint(uuid, uuid, uuid),
  public.get_ghost_report(uuid, uuid)
from public, anon;
grant execute on function
  public.submit_ghost_watch(uuid, uuid, uuid),
  public.set_ghost_hint(uuid, uuid, uuid),
  public.get_ghost_report(uuid, uuid)
to authenticated;
