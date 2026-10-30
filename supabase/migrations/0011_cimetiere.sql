-- =====================================================
-- BLUFF : étape 3, le Cimetière
--   * 7e lieu (croisement visible, soumis à la règle de mort comme les autres).
--   * Chaque fantôme choisit en secret une tombe parmi tomb_count (tirée au hasard s'il n'a pas choisi).
--   * Un vivant qui va au Cimetière peut choisir une tombe (cemetery_cost jetons) : si un ou plusieurs
--     fantômes l'ont choisie, il apprend leur nom et leur suspect actuel (qui peut mentir).
--   * Deux réglages en plus : cemetery_cost (1) et tomb_count (3).
-- À coller dans Supabase > SQL Editor > New query > Run (après 0010)
-- =====================================================

insert into public.locations (id, name, visible_crossing) values ('cimetiere', 'Cimetière', true);

-- 1. Réglages
create or replace function public.game_param(p_key text)
returns int language sql immutable as $$
  select case p_key
    when 'poste_garde_cost' then 2
    when 'planque_cost'     then 2
    when 'rumeur3_cost'     then 1
    when 'rumeur2_cost'     then 2
    when 'don_cost'         then 1
    when 'casino_max'       then 3
    when 'casino_win_pct'   then 50
    when 'mairie_cost'      then 2
    when 'kill_majority_pct' then 100  -- Saboteurs > Villageois dans un lieu
    when 'kill_tie_pct'     then 50    -- Saboteurs = Villageois
    when 'kill_minority_pct' then 0    -- Saboteurs < Villageois (au moins un Saboteur présent)
    when 'death_reveals_location' then 0
    when 'tokens_start_villager'  then 1
    when 'tokens_start_saboteur'  then 2
    when 'tokens_income_villager' then 1   -- jetons gagnés chaque nuit (à partir de la nuit 2)
    when 'tokens_income_saboteur' then 1
    when 'saboteurs_count'  then 0     -- 0 = automatique (1 jusqu'à 5 joueurs, 2 à partir de 6)
    when 'vote_runoff_max'  then 3     -- nombre de nouveaux votes en cas d'égalité
    when 'cemetery_cost'    then 1     -- coût pour choisir une tombe au Cimetière
    when 'tomb_count'       then 3     -- nombre de tombes
    when 'timers_on'        then 0
  end;
$$;

create or replace function public.setting_bounds()
returns table(key text, lo int, hi int)
language sql immutable as $$
  values
    ('saboteurs_count', 0, 4), ('tokens_start_villager', 0, 10), ('tokens_start_saboteur', 0, 10),
    ('tokens_income_villager', 0, 5), ('tokens_income_saboteur', 0, 5),
    ('kill_majority_pct', 0, 100), ('kill_tie_pct', 0, 100), ('kill_minority_pct', 0, 100),
    ('death_reveals_location', 0, 1),
    ('poste_garde_cost', 0, 9), ('planque_cost', 0, 9), ('rumeur3_cost', 0, 9), ('rumeur2_cost', 0, 9),
    ('don_cost', 0, 9), ('mairie_cost', 0, 9), ('casino_max', 0, 9), ('casino_win_pct', 0, 100),
    ('cemetery_cost', 0, 9), ('tomb_count', 2, 6),
    ('vote_runoff_max', 0, 9)
$$;

alter table public.ghost_hints add column tomb int;

-- 2. Le fantôme choisit sa tombe (secret ; modifiable à tout moment)
create or replace function public.set_ghost_tomb(
  p_room_id uuid, p_tomb int, p_player_id uuid default null)
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
  if p_tomb is null or p_tomb < 1 or p_tomb > public.room_param(p_room_id, 'tomb_count') then
    raise exception 'invalid_params';
  end if;

  insert into public.ghost_hints (player_id, tomb, updated_round)
  values (v_ghost.id, p_tomb, v_room.round)
  on conflict (player_id) do update set tomb = excluded.tomb;
end $$;

-- 3. Rapport du fantôme (ajoute sa tombe)
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
    'tomb', (select h.tomb from public.ghost_hints h where h.player_id = v_ghost.id));
end $$;

-- 4. Choix de la nuit (tombe du Cimetière)
create or replace function public.submit_night_action(
  p_room_id uuid, p_location text, p_player_id uuid default null, p_params jsonb default '{}'::jsonb)
returns void
language plpgsql security definer set search_path = public as $$
declare
  v_room   public.rooms;
  v_target public.players;
  v_tokens int;
  v_team   text;
  v_clean  jsonb := '{}'::jsonb;
  v_params jsonb := coalesce(p_params, '{}'::jsonb);
  v_stake  int;
  v_t      uuid;
  v_arr    uuid[];
  v_n      int;
  v_act    text;
  v_sab    text;
  v_cost   int;
  v_rig    text;
begin
  select * into v_room from public.rooms where id = p_room_id for update;
  if not found then raise exception 'room_not_found'; end if;

  v_target := public.resolve_target(p_room_id, p_player_id);

  if v_room.status <> 'playing' or v_room.phase <> 'night' then raise exception 'not_night'; end if;
  if not v_target.is_alive then raise exception 'player_dead'; end if;
  if not exists (select 1 from public.locations where id = p_location) then
    raise exception 'invalid_location';
  end if;
  if exists (select 1 from public.closures
             where room_id = p_room_id and round = v_room.round and location = p_location) then
    raise exception 'location_closed';
  end if;
  if jsonb_typeof(v_params) is distinct from 'object' then raise exception 'invalid_params'; end if;

  -- La maison ne peut pas être choisie deux nuits de suite
  if p_location = 'maison' and exists (
       select 1 from public.night_actions
       where room_id = p_room_id and round = v_room.round - 1
         and player_id = v_target.id and location = 'maison') then
    raise exception 'maison_twice';
  end if;

  select tokens, team into v_tokens, v_team from public.player_secrets where player_id = v_target.id;
  v_tokens := coalesce(v_tokens, 0);

  if p_location = 'casino' then
    v_stake := 0;
    if v_params->>'stake' is not null then
      v_stake := public.try_int(v_params->>'stake');
      if v_stake is null or v_stake < 0 or v_stake > public.room_param(p_room_id, 'casino_max') then
        raise exception 'invalid_params';
      end if;
    end if;
    if v_stake > v_tokens then raise exception 'not_enough_tokens'; end if;
    v_clean := jsonb_build_object('stake', v_stake);

  elsif p_location = 'taverne' then
    v_act := coalesce(v_params->>'action', 'none');
    if v_act = 'don' then
      v_t := public.try_uuid(v_params->>'target');
      if v_t is null or v_t = v_target.id
         or not exists (select 1 from public.players
                        where id = v_t and room_id = p_room_id and is_alive) then
        raise exception 'invalid_target';
      end if;
      if v_tokens < public.room_param(p_room_id, 'don_cost') then raise exception 'not_enough_tokens'; end if;
      v_clean := jsonb_build_object('action', 'don', 'target', v_t);

    elsif v_act = 'rumeur' then
      if jsonb_typeof(v_params->'targets') is distinct from 'array' then
        raise exception 'invalid_params';
      end if;
      v_n := jsonb_array_length(v_params->'targets');
      if v_n not in (2, 3) then raise exception 'invalid_params'; end if;
      select array_agg(distinct public.try_uuid(e)) into v_arr
      from jsonb_array_elements_text(v_params->'targets') e;
      if cardinality(v_arr) <> v_n or null = any(v_arr) then raise exception 'invalid_params'; end if;
      if (select count(*) from public.players
          where id = any(v_arr) and room_id = p_room_id and is_alive and id <> v_target.id) <> v_n then
        raise exception 'invalid_target';
      end if;
      v_cost := case when v_n = 3 then public.room_param(p_room_id, 'rumeur3_cost') else public.room_param(p_room_id, 'rumeur2_cost') end;
      if v_tokens < v_cost then raise exception 'not_enough_tokens'; end if;
      v_clean := jsonb_build_object('action', 'rumeur', 'targets', to_jsonb(v_arr));

    elsif v_act = 'none' then
      v_clean := jsonb_build_object('action', 'none');
    else
      raise exception 'invalid_params';
    end if;

  elsif p_location = 'poste_garde' then
    if v_params->>'target' is not null then
      v_t := public.try_uuid(v_params->>'target');
      if v_t is null or v_t = v_target.id
         or not exists (select 1 from public.players
                        where id = v_t and room_id = p_room_id and is_alive) then
        raise exception 'invalid_target';
      end if;
      if v_tokens < public.room_param(p_room_id, 'poste_garde_cost') then raise exception 'not_enough_tokens'; end if;
      v_clean := jsonb_build_object('target', v_t);
    end if;

  elsif p_location = 'planque' then
    v_sab := v_params->>'sabotage';
    if v_sab is not null then
      if v_team is distinct from 'saboteurs' then raise exception 'not_saboteur'; end if;
      if v_sab not in ('casino', 'taverne', 'poste_garde') then raise exception 'invalid_location'; end if;
      if v_tokens < public.room_param(p_room_id, 'planque_cost') then raise exception 'not_enough_tokens'; end if;
      v_clean := jsonb_build_object('sabotage', v_sab);
    end if;

  elsif p_location = 'mairie' then
    v_rig := v_params->>'rig';
    if v_rig is not null then
      if v_rig not in ('boost', 'shield') then raise exception 'invalid_params'; end if;
      if v_rig = 'boost' then
        v_t := public.try_uuid(v_params->>'target');
        if v_t is null or v_t = v_target.id
           or not exists (select 1 from public.players
                          where id = v_t and room_id = p_room_id and is_alive) then
          raise exception 'invalid_target';
        end if;
        v_clean := jsonb_build_object('rig', 'boost', 'target', v_t);
      else
        v_clean := jsonb_build_object('rig', 'shield');
      end if;
      if v_tokens < public.room_param(p_room_id, 'mairie_cost') then raise exception 'not_enough_tokens'; end if;
    end if;
  elsif p_location = 'cimetiere' then
    if v_params->>'tomb' is not null then
      v_n := public.try_int(v_params->>'tomb');
      if v_n is null or v_n < 1 or v_n > public.room_param(p_room_id, 'tomb_count') then
        raise exception 'invalid_params';
      end if;
      if v_tokens < public.room_param(p_room_id, 'cemetery_cost') then raise exception 'not_enough_tokens'; end if;
      v_clean := jsonb_build_object('tomb', v_n);
    end if;
  end if;

  insert into public.night_actions (room_id, round, player_id, location, params)
  values (p_room_id, v_room.round, v_target.id, p_location, v_clean)
  on conflict (room_id, round, player_id)
  do update set location = excluded.location, params = excluded.params, created_at = now();

  perform public.advance_phase(p_room_id, false);
end $$;

-- 5. Résolution de la nuit (visites du Cimetière)
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
  v_tomb    int;
  v_hints   jsonb;
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

  -- Chaque fantôme a une ligne (suspect : au hasard pour les bots) et une tombe (au hasard tant qu'il n'a pas choisi)
  insert into public.ghost_hints (player_id, suspect_id, updated_round)
  select g.id,
         case when g.is_bot then (select p2.id from public.players p2
                                  where p2.room_id = p_room_id and p2.is_alive order by random() limit 1)
              else null end,
         v_round
  from public.players g
  where g.room_id = p_room_id and not g.is_alive
  on conflict (player_id) do nothing;

  update public.ghost_hints h
  set tomb = 1 + floor(random() * public.room_param(p_room_id, 'tomb_count'))::int
  from public.players g
  where g.id = h.player_id and g.room_id = p_room_id and not g.is_alive and h.tomb is null;

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
    elsif a.location = 'cimetiere' then
      v_tomb := public.try_int(a.params->>'tomb');
      if v_tomb is not null then
        if public.spend_tokens(a.player_id, public.room_param(p_room_id, 'cemetery_cost')) then
          -- les fantômes qui ont choisi cette tombe parlent (leur suspect actuel, qui peut mentir)
          select coalesce(jsonb_agg(jsonb_build_object('ghost_id', h.player_id, 'suspect_id', h.suspect_id)
                                    order by h.player_id), '[]'::jsonb)
          into v_hints
          from public.ghost_hints h
          join public.players g on g.id = h.player_id
          where g.room_id = p_room_id and not g.is_alive and h.tomb = v_tomb;
          perform public.add_night_result(p_room_id, v_round, a.player_id,
            jsonb_build_object('cimetiere', jsonb_build_object('tomb', v_tomb, 'ok', true, 'spirits', v_hints)));
        else
          perform public.add_night_result(p_room_id, v_round, a.player_id,
            jsonb_build_object('cimetiere', jsonb_build_object('tomb', v_tomb, 'ok', false, 'spirits', '[]'::jsonb)));
        end if;
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

revoke execute on function public.set_ghost_tomb(uuid, int, uuid) from public, anon;
grant execute on function public.set_ghost_tomb(uuid, int, uuid) to authenticated;
