-- =====================================================
-- BLUFF : étape 3c
--   Phases manuelles (plus de minuteurs) : l'hôte fait avancer la partie
--   Taverne : le don n'a lieu que si le receveur est aussi à la Taverne
--   Progression de la nuit visible (X/Y ont choisi)
-- À coller dans Supabase > SQL Editor > New query > Run
-- =====================================================

-- 1. Paramètres du jeu (on ajoute timers_on)
create or replace function public.game_param(p_key text)
returns int language sql immutable as $$
  select case p_key
    when 'poste_garde_cost' then 2
    when 'planque_cost'     then 2
    when 'rumeur3_cost'     then 1   -- rumeur sur un groupe de 3
    when 'rumeur2_cost'     then 2   -- rumeur sur un groupe de 2 (plus précise, donc plus chère)
    when 'don_cost'         then 1
    when 'casino_max'       then 3
    when 'casino_win_pct'   then 50
    when 'timers_on'        then 0   -- 0 = phases manuelles (hôte), 1 = minuteurs actifs
  end;
$$;

-- 2. Plus de minuteurs : phase_ends_at reste vide tant que timers_on = 0
create or replace function public.rooms_apply_timer_setting()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if public.game_param('timers_on') = 0 then new.phase_ends_at := null; end if;
  return new;
end $$;

drop trigger if exists rooms_timer_setting on public.rooms;
create trigger rooms_timer_setting
  before insert or update on public.rooms
  for each row execute function public.rooms_apply_timer_setting();

update public.rooms set phase_ends_at = null;

-- 3. Résolution de la nuit : le don exige la présence du receveur à la Taverne
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
                       order by random() limit 1)
                 else 'maison' end);
  end loop;

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
          v_win := random() * 100 < public.game_param('casino_win_pct');
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
        v_cost := public.game_param('don_cost');
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
                       then public.game_param('rumeur3_cost') else public.game_param('rumeur2_cost') end;
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
      if v_target is not null and public.spend_tokens(a.player_id, public.game_param('poste_garde_cost')) then
        select na.location into v_loc from public.night_actions na
        where na.room_id = p_room_id and na.round = v_round and na.player_id = v_target;
        perform public.add_night_result(p_room_id, v_round, a.player_id,
          jsonb_build_object('observation', jsonb_build_object('target', v_target, 'location', v_loc)));
      end if;

    elsif a.location = 'planque' then
      v_sab := a.params->>'sabotage';
      if v_sab is not null and public.spend_tokens(a.player_id, public.game_param('planque_cost')) then
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
    end if;
  end loop;

  update public.rooms
  set phase = 'day',
      phase_ends_at = now() + make_interval(secs => public.phase_seconds('day'))
  where id = p_room_id;
end $$;

-- 4. Passage à la phase suivante : par l'hôte (p_force), ou par minuteur si timers_on = 1
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
    perform public.start_night(p_room_id);
  end if;
end $$;

-- 5. Progression de la nuit (aucun secret : seulement un compteur)
create or replace function public.night_progress(p_room_id uuid)
returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  v_room public.rooms;
begin
  select * into v_room from public.rooms where id = p_room_id;
  if not found then raise exception 'room_not_found'; end if;
  if not public.is_room_member(p_room_id) then raise exception 'not_member'; end if;
  return jsonb_build_object(
    'played', (select count(*) from public.night_actions a
               join public.players p on p.id = a.player_id
               where a.room_id = p_room_id and a.round = v_room.round and p.is_alive),
    'total', (select count(*) from public.players where room_id = p_room_id and is_alive));
end $$;

revoke execute on function public.night_progress(uuid) from public, anon;
grant  execute on function public.night_progress(uuid) to authenticated;
revoke execute on function public.rooms_apply_timer_setting() from public, anon, authenticated;
