-- =====================================================
-- BLUFF : validation des choix, minuteurs réglables, jetons de départ, prix des rumeurs
--   * Chaque choix (lieu + action, vote, observation d'un fantôme) se valide puis peut être annulé
--     (« Retour »). L'hôte ne peut passer à la phase suivante (nuit, vote) que si tous les joueurs
--     humains vivants ont validé. Les bots jouent seuls à la résolution.
--   * Minuteurs réglables dans le salon (timers_on, night_seconds, day_seconds, vote_seconds) :
--     désactivés par défaut. Un minuteur écoulé passe à la suite sans exiger la validation.
--   * Jetons de départ du Saboteur : 3 s'il est seul, 2 chacun s'ils sont plusieurs.
--   * Rumeurs : +1 jeton (3 joueurs : 2, 2 joueurs : 3, petite partie : 4).
-- À coller dans Supabase > SQL Editor > New query > Run (après 0013)
-- =====================================================

create or replace function public.game_param(p_key text)
returns int language sql immutable as $$
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
    ('mairie_boost', 1, 3), ('rumeur_small_cost', 0, 9), ('rumeur_small_max_players', 0, 10), ('sudden_death_on', 0, 1),
    ('tokens_start_saboteur_solo', 0, 10),
    ('timers_on', 0, 1), ('night_seconds', 30, 600), ('day_seconds', 30, 900), ('vote_seconds', 30, 600),
    ('vote_runoff_max', 0, 9)
$$;

create or replace function public.room_phase_seconds(p_room uuid, p_phase text)
returns int
language sql stable security definer set search_path = public as $$
  select case p_phase
    when 'night' then public.room_param(p_room, 'night_seconds')
    when 'day'   then public.room_param(p_room, 'day_seconds')
    else public.room_param(p_room, 'vote_seconds') end;
$$;

create or replace function public.rooms_apply_timer_setting()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if public.room_param(new.id, 'timers_on') = 0 then new.phase_ends_at := null; end if;
  return new;
end $$;

create or replace function public.start_game(p_room_id uuid)
returns void
language plpgsql security definer set search_path = public as $$
declare
  v_room  public.rooms;
  v_count int;
  v_s int;
  v_sol int;
  v_v int;
  v_spec int;
  v_sab  text[];
  v_vil  text[];
  v_solo text[];
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

  -- 2 Saboteurs maximum (1 jusqu'à 5 joueurs)
  v_s := case when public.room_param(p_room_id, 'saboteurs_count') > 0
              then least(public.room_param(p_room_id, 'saboteurs_count'), v_count - 1)
              else case when v_count <= 5 then 1 else 2 end end;

  if v_room.mode = 'simple' then
    -- Version simplifiée : deux camps, aucun pouvoir
    v_roles := array(select 'saboteur_simple'::text from generate_series(1, v_s))
            || array(select 'villageois_simple'::text from generate_series(1, v_count - v_s));
  else
    -- Version avec rôles (sera activée plus tard)
    v_sol  := case when v_count < 6 then 0 when v_count = 6 then 1 else 2 end;
    v_v    := v_count - v_s - v_sol;
    v_spec := least(v_v, 5);

    select coalesce(array_agg(r), '{}'::text[]) into v_sab
    from (select r from unnest(array['saboteur', 'corrupteur', 'cameleon', 'intercepteur']) as r
          order by random() limit v_s) x;

    if 'intercepteur' = any(v_sab) then
      select array['mecene'] || coalesce(array_agg(r), '{}'::text[]) into v_vil
      from (select r from unnest(array['enqueteur', 'garde_du_corps', 'juge', 'temoin']) as r
            order by random() limit v_spec - 1) x;
    else
      select coalesce(array_agg(r), '{}'::text[]) into v_vil
      from (select r from unnest(array['mecene', 'enqueteur', 'garde_du_corps', 'juge', 'temoin']) as r
            order by random() limit v_spec) x;
    end if;
    v_vil := v_vil || array(select 'villageois_simple'::text from generate_series(1, v_v - v_spec));

    select coalesce(array_agg(r), '{}'::text[]) into v_solo
    from (select r from unnest(array['capitaliste', 'opportuniste']) as r
          order by random() limit v_sol) x;

    v_roles := v_sab || v_vil || v_solo;
  end if;

  if array_length(v_roles, 1) is distinct from v_count then
    raise exception 'distribution_error';
  end if;

  -- Attribution aléatoire (bots inclus) : 2 jetons pour les Saboteurs, 1 pour les autres
  insert into public.player_secrets (player_id, role_id, team, tokens)
  select s.id,
         s.role_id,
         public.role_team(s.role_id),
         case when public.role_team(s.role_id) = 'saboteurs'
              then case when v_s = 1 then public.room_param(p_room_id, 'tokens_start_saboteur_solo')
                        else public.room_param(p_room_id, 'tokens_start_saboteur') end
              else public.room_param(p_room_id, 'tokens_start_villager') end
  from (
    select p.id,
           v_roles[(row_number() over (order by random()))::int] as role_id
    from public.players p
    where p.room_id = p_room_id
  ) s;

  update public.rooms
  set status = 'playing',
      round = 1,
      phase = 'night',
      phase_ends_at = now() + make_interval(secs => public.room_phase_seconds(p_room_id, 'night'))
  where id = p_room_id;
end $$;

create or replace function public.start_night(p_room_id uuid)
returns void
language plpgsql security definer set search_path = public as $$
begin
  update public.rooms
  set round = round + 1,
      phase = 'night',
      vote_step = 0,
      vote_candidates = null,
      phase_ends_at = now() + make_interval(secs => public.room_phase_seconds(p_room_id, 'night'))
  where id = p_room_id;

  update public.player_secrets s
  set tokens = s.tokens + case when s.team = 'saboteurs'
                               then public.room_param(p_room_id, 'tokens_income_saboteur')
                               else public.room_param(p_room_id, 'tokens_income_villager') end
  from public.players p
  where p.id = s.player_id and p.room_id = p_room_id and p.is_alive;
end $$;

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
  v_sab_locs text[] := '{}';
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
                         and not (l.id = 'cimetiere' and not exists (
                                    select 1 from public.players pd
                                    where pd.room_id = p_room_id and not pd.is_alive))
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

  -- 1c. Sabotages de la Planque (anonymes, effet immédiat cette nuit). Ils échouent (jetons perdus)
  --     si un joueur hors Saboteurs se trouve aussi à la Planque.
  for a in
    select na.player_id, na.params
    from public.night_actions na
    where na.room_id = p_room_id and na.round = v_round
      and na.location = 'planque' and na.params ? 'sabotage'
    order by na.created_at, na.player_id
  loop
    v_sab := a.params->>'sabotage';
    if public.spend_tokens(a.player_id, public.room_param(p_room_id, 'planque_cost')) then
      v_ok := not exists (
        select 1
        from public.night_actions na
        join public.player_secrets s on s.player_id = na.player_id
        where na.room_id = p_room_id and na.round = v_round
          and na.location = 'planque' and s.team <> 'saboteurs');
      if v_ok then v_sab_locs := array_append(v_sab_locs, v_sab); end if;
      perform public.add_night_result(p_room_id, v_round, a.player_id,
        jsonb_build_object('sabotage', jsonb_build_object('location', v_sab, 'success', v_ok)));
    end if;
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
          v_win := not ('casino' = any(v_sab_locs))
                   and random() * 100 < public.room_param(p_room_id, 'casino_win_pct');
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
        v_cost := public.rumeur_cost(p_room_id, cardinality(v_targets));
        if public.spend_tokens(a.player_id, v_cost) then
          -- le Caméléon passe pour un innocent
          v_has := exists (select 1 from public.player_secrets
                           where player_id = any(v_targets) and team = 'saboteurs' and role_id <> 'cameleon');
          if 'taverne' = any(v_sab_locs) then v_has := not v_has; end if;   -- taverne sabotée : information fausse
          perform public.add_night_result(p_room_id, v_round, a.player_id,
            jsonb_build_object('rumeur', jsonb_build_object('targets', to_jsonb(v_targets), 'has_saboteur', v_has)));
        end if;
      end if;

    elsif a.location = 'poste_garde' then
      v_target := public.try_uuid(a.params->>'target');
      if v_target is not null and public.spend_tokens(a.player_id, public.room_param(p_room_id, 'poste_garde_cost')) then
        select na.location into v_loc from public.night_actions na
        where na.room_id = p_room_id and na.round = v_round and na.player_id = v_target;
        if 'poste_garde' = any(v_sab_locs) then   -- poste sabotée : on annonce un autre lieu
          select l.id into v_loc from public.locations l where l.id is distinct from v_loc order by random() limit 1;
        end if;
        perform public.add_night_result(p_room_id, v_round, a.player_id,
          jsonb_build_object('observation', jsonb_build_object('target', v_target, 'location', v_loc)));
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
            -- mairie sabotée : le tricheur écope d'une voix contre lui (il croit avoir réussi)
            insert into public.vote_tampering (room_id, round, player_id, kind, target_id)
            values (p_room_id, v_round, a.player_id,
                    case when 'mairie' = any(v_sab_locs) then 'backfire' else v_rig end,
                    case when 'mairie' = any(v_sab_locs) then a.player_id
                         else public.try_uuid(a.params->>'target') end);
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
  v_win_t := public.update_victory(p_room_id, false);

  update public.rooms
  set phase = case when v_win_t is null then 'day' else 'ended' end,
      winner = v_win_t,
      phase_ends_at = case when v_win_t is null
                           then now() + make_interval(secs => public.room_phase_seconds(p_room_id, 'day'))
                           else null end
  where id = p_room_id;
end $$;

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
    or (public.room_param(p_room_id, 'timers_on') = 1 and v_room.phase_ends_at <= now()),
    false);
  if not v_due then return; end if;

  -- Passage manuel par l'hôte : tous les joueurs vivants (hors bots) doivent avoir validé leur choix
  if p_force then
    if v_room.phase = 'night' and exists (
         select 1 from public.players p
         where p.room_id = p_room_id and p.is_alive and not p.is_bot
           and not exists (select 1 from public.night_actions a
                           where a.room_id = p_room_id and a.round = v_room.round and a.player_id = p.id)) then
      raise exception 'players_not_ready';
    end if;
    if v_room.phase = 'vote' and exists (
         select 1 from public.players p
         where p.room_id = p_room_id and p.is_alive and not p.is_bot
           and not exists (select 1 from public.votes v
                           where v.room_id = p_room_id and v.round = v_room.round and v.voter_id = p.id)) then
      raise exception 'players_not_ready';
    end if;
  end if;

  if v_room.phase = 'night' then
    perform public.resolve_night(p_room_id);
  elsif v_room.phase = 'day' then
    update public.rooms
    set phase = 'vote', phase_ends_at = now() + make_interval(secs => public.room_phase_seconds(p_room_id, 'vote'))
    where id = p_room_id;
  elsif v_room.phase = 'vote' then
    perform public.resolve_vote(p_room_id);
  elsif v_room.phase = 'result' then
    perform public.start_night(p_room_id);
  end if;
end $$;

create or replace function public.night_progress(p_room_id uuid)
returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  v_room public.rooms;
begin
  select * into v_room from public.rooms where id = p_room_id;
  if not found then raise exception 'room_not_found'; end if;
  if not public.is_room_member(p_room_id) then raise exception 'not_member'; end if;
  -- joueurs humains vivants ayant validé leur choix (les bots jouent seuls à la résolution)
  return jsonb_build_object(
    'played', (select count(*) from public.night_actions a
               join public.players p on p.id = a.player_id
               where a.room_id = p_room_id and a.round = v_room.round and p.is_alive and not p.is_bot),
    'total', (select count(*) from public.players where room_id = p_room_id and is_alive and not is_bot));
end $$;

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
               where v.room_id = p_room_id and v.round = v_room.round and p.is_alive and not p.is_bot),
    'total', (select count(*) from public.players where room_id = p_room_id and is_alive and not is_bot));
end $$;

-- Annuler (« Retour ») : le joueur reprend la main sur son choix
create or replace function public.cancel_night_action(p_room_id uuid, p_player_id uuid default null)
returns void
language plpgsql security definer set search_path = public as $$
declare
  v_room   public.rooms;
  v_player public.players;
begin
  select * into v_room from public.rooms where id = p_room_id for update;
  if not found then raise exception 'room_not_found'; end if;
  v_player := public.resolve_target(p_room_id, p_player_id);
  if v_room.status <> 'playing' or v_room.phase <> 'night' then raise exception 'not_night'; end if;
  delete from public.night_actions
  where room_id = p_room_id and round = v_room.round and player_id = v_player.id;
end $$;

create or replace function public.cancel_vote(p_room_id uuid, p_player_id uuid default null)
returns void
language plpgsql security definer set search_path = public as $$
declare
  v_room   public.rooms;
  v_player public.players;
begin
  select * into v_room from public.rooms where id = p_room_id for update;
  if not found then raise exception 'room_not_found'; end if;
  v_player := public.resolve_target(p_room_id, p_player_id);
  if v_room.status <> 'playing' or v_room.phase <> 'vote' then raise exception 'not_vote'; end if;
  delete from public.votes
  where room_id = p_room_id and round = v_room.round and voter_id = v_player.id;
end $$;

create or replace function public.cancel_ghost_watch(p_room_id uuid, p_player_id uuid default null)
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
  delete from public.ghost_watch
  where room_id = p_room_id and round = v_room.round and ghost_id = v_ghost.id;
end $$;

revoke execute on function public.room_phase_seconds(uuid, text) from public, anon, authenticated;
revoke execute on function public.cancel_night_action(uuid, uuid), public.cancel_vote(uuid, uuid),
  public.cancel_ghost_watch(uuid, uuid) from public, anon;
grant execute on function public.cancel_night_action(uuid, uuid), public.cancel_vote(uuid, uuid),
  public.cancel_ghost_watch(uuid, uuid) to authenticated;
