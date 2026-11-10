-- =====================================================
-- BLUFF : corrections et options (retours parties à 7)
--   * Planque (option planque_kill_first) : le meurtre est résolu avant le sabotage ; le sabotage réussit
--     s'il ne reste aucun joueur hors Saboteurs vivant à la Planque. Plusieurs saboteurs : chacun sabote
--     un lieu, un même lieu n'est payé qu'une fois.
--   * Casino saboté (option casino_sabotage_steal) : le saboteur empoche la moitié des mises jouées.
--   * Cimetière nominatif (option cemetery_named) : on choisit le fantôme (non saboteur) par son nom.
--   * Fantôme saboteur (option ghost_haunt_on) : il hante un saboteur vivant ; dans son lieu, la chance
--     de meurtre gagne ghost_haunt_bonus_pct (25 points) par fantôme.
--   * Vision des Saboteurs (option saboteur_vision) : pendant la nuit, les Saboteurs vivants et les fantômes
--     saboteurs voient les lieux validés de leurs alliés vivants et les hantises en cours.
-- À coller dans Supabase > SQL Editor > New query > Run (après 0014)
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
    when 'casino_sabotage_steal' then 1  -- casino saboté : le saboteur empoche la moitié des mises jouées
    when 'planque_kill_first'    then 1  -- Planque : le meurtre est résolu avant le sabotage
    when 'cemetery_named'        then 1  -- Cimetière : on choisit le fantôme par son nom (fantômes non saboteurs)
    when 'ghost_haunt_on'        then 1  -- fantôme saboteur : peut hanter le lieu d'un saboteur vivant
    when 'ghost_haunt_bonus_pct' then 25 -- points de chance de meurtre ajoutés par fantôme qui hante
    when 'saboteur_vision'       then 1  -- les Saboteurs (et fantômes saboteurs) voient les lieux validés de leurs alliés
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
    ('casino_sabotage_steal', 0, 1), ('planque_kill_first', 0, 1), ('cemetery_named', 0, 1),
    ('ghost_haunt_on', 0, 1), ('ghost_haunt_bonus_pct', 0, 100), ('saboteur_vision', 0, 1),
    ('vote_runoff_max', 0, 9)
$$;

-- Fantômes saboteurs : allié vivant accompagné (hanté) cette nuit
create table if not exists public.ghost_haunts (
  room_id  uuid not null references public.rooms(id) on delete cascade,
  round    int  not null,
  ghost_id uuid not null references public.players(id) on delete cascade,
  ally_id  uuid not null references public.players(id) on delete cascade,
  primary key (room_id, round, ghost_id)
);
alter table public.ghost_haunts enable row level security;
revoke all on public.ghost_haunts from anon, authenticated;

-- Meurtre éventuel dans un lieu (au plus un mort). Renvoie la victime ou null.
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

  -- fantômes saboteurs qui hantent ce lieu (ils accompagnent un saboteur vivant présent ici) : +bonus chacun
  if public.room_param(p_room, 'ghost_haunt_on') = 1 then
    select count(*) into v_h from public.ghost_haunts h
       join public.players g on g.id = h.ghost_id and not g.is_alive
       join public.player_secrets gs on gs.player_id = h.ghost_id and gs.team = 'saboteurs'
       join public.night_actions na on na.room_id = p_room and na.round = p_round
                                   and na.player_id = h.ally_id and na.location = p_loc
       join public.players al on al.id = h.ally_id and al.is_alive
       where h.room_id = p_room and h.round = p_round;
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
  v_casino_sab uuid;
  v_stolen  int := 0;
  v_kfirst  boolean := public.room_param(p_room_id, 'planque_kill_first') = 1;
  v_ghost   uuid;
  v_tried   text[] := '{}';
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

  -- 1b'. Fantômes saboteurs bots : ils hantent un saboteur vivant au hasard
  if public.room_param(p_room_id, 'ghost_haunt_on') = 1 then
    insert into public.ghost_haunts (room_id, round, ghost_id, ally_id)
    select p_room_id, v_round, g.id,
           (select al.id from public.players al join public.player_secrets als on als.player_id = al.id
            where al.room_id = p_room_id and al.is_alive and als.team = 'saboteurs' order by random() limit 1)
    from public.players g
    join public.player_secrets gs on gs.player_id = g.id and gs.team = 'saboteurs'
    where g.room_id = p_room_id and not g.is_alive and g.is_bot
      and exists (select 1 from public.players al join public.player_secrets als on als.player_id = al.id
                  where al.room_id = p_room_id and al.is_alive and als.team = 'saboteurs')
    on conflict do nothing;
  end if;

  -- 1c. Planque : d'abord le meurtre (option), puis les sabotages (anonymes, effet immédiat cette nuit).
  --     Un sabotage échoue (jetons perdus) si un joueur hors Saboteurs, encore vivant, est à la Planque.
  --     Plusieurs saboteurs : chacun sabote un lieu ; un même lieu n'est payé qu'une fois.
  if v_kfirst then perform public.night_kill(p_room_id, v_round, 'planque'); end if;
  for a in
    select na.player_id, na.params
    from public.night_actions na
    where na.room_id = p_room_id and na.round = v_round
      and na.location = 'planque' and na.params ? 'sabotage'
    order by na.created_at, na.player_id
  loop
    v_sab := a.params->>'sabotage';
    if v_sab = any(v_tried) then
      -- lieu déjà visé par un allié cette nuit : rien à payer, même issue
      perform public.add_night_result(p_room_id, v_round, a.player_id,
        jsonb_build_object('sabotage', jsonb_build_object('location', v_sab, 'success', v_sab = any(v_sab_locs), 'shared', true)));
    elsif public.spend_tokens(a.player_id, public.room_param(p_room_id, 'planque_cost')) then
      v_tried := array_append(v_tried, v_sab);
      v_ok := not exists (
        select 1
        from public.night_actions na
        join public.player_secrets s on s.player_id = na.player_id
        join public.players p on p.id = na.player_id and p.is_alive
        where na.room_id = p_room_id and na.round = v_round
          and na.location = 'planque' and s.team <> 'saboteurs');
      if v_ok then
        v_sab_locs := array_append(v_sab_locs, v_sab);
        if v_sab = 'casino' then v_casino_sab := a.player_id; end if;
      end if;
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
          -- casino saboté : on compte les mises perdues, le saboteur en touchera la moitié
          if 'casino' = any(v_sab_locs) and a.player_id is distinct from v_casino_sab then
            v_stolen := v_stolen + v_stake;
          end if;
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
    elsif a.location = 'cimetiere' and a.params ? 'ghost' then
      -- Cimetière nominatif : on interroge le fantôme choisi
      v_ghost := public.try_uuid(a.params->>'ghost');
      if public.spend_tokens(a.player_id, public.room_param(p_room_id, 'cemetery_cost')) then
        select coalesce(jsonb_agg(jsonb_build_object('ghost_id', h.player_id, 'suspect_id', h.suspect_id)), '[]'::jsonb)
        into v_hints
        from public.ghost_hints h
        where h.player_id = v_ghost;
        if v_hints = '[]'::jsonb then
          v_hints := jsonb_build_array(jsonb_build_object('ghost_id', v_ghost, 'suspect_id', null));
        end if;
        perform public.add_night_result(p_room_id, v_round, a.player_id,
          jsonb_build_object('cimetiere', jsonb_build_object('ghost', v_ghost, 'ok', true, 'spirits', v_hints)));
      else
        perform public.add_night_result(p_room_id, v_round, a.player_id,
          jsonb_build_object('cimetiere', jsonb_build_object('ghost', v_ghost, 'ok', false, 'spirits', '[]'::jsonb)));
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

  -- casino saboté : la moitié des mises jouées (arrondie au supérieur) va au saboteur
  v_stolen := ceil(v_stolen / 2.0)::int;
  if v_stolen > 0 and v_casino_sab is not null and public.room_param(p_room_id, 'casino_sabotage_steal') = 1 then
    update public.player_secrets set tokens = tokens + v_stolen where player_id = v_casino_sab;
    perform public.add_night_result(p_room_id, v_round, v_casino_sab, jsonb_build_object('casino_steal', v_stolen));
  end if;

  -- 3. Meurtres : au plus un mort par lieu (hors maison), voir night_kill. La Planque a déjà été traitée.
  for k in
    select distinct na.location from public.night_actions na
    where na.room_id = p_room_id and na.round = v_round and na.location <> 'maison'
      and not (v_kfirst and na.location = 'planque')
    order by na.location
  loop
    perform public.night_kill(p_room_id, v_round, k.location);
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
  -- Le Cimetière n'ouvre qu'à partir du premier mort
  if p_location = 'cimetiere' and not exists (
       select 1 from public.players where room_id = p_room_id and not is_alive) then
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
      if v_n <> 3 and public.rumeur_small(p_room_id) then raise exception 'invalid_params'; end if;
      select array_agg(distinct public.try_uuid(e)) into v_arr
      from jsonb_array_elements_text(v_params->'targets') e;
      if cardinality(v_arr) <> v_n or null = any(v_arr) then raise exception 'invalid_params'; end if;
      if (select count(*) from public.players
          where id = any(v_arr) and room_id = p_room_id and is_alive and id <> v_target.id) <> v_n then
        raise exception 'invalid_target';
      end if;
      v_cost := public.rumeur_cost(p_room_id, v_n);
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
      if v_sab not in ('casino', 'taverne', 'poste_garde', 'mairie') then raise exception 'invalid_location'; end if;
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
  elsif p_location = 'cimetiere' and v_params->>'ghost' is not null then
    if public.room_param(p_room_id, 'cemetery_named') <> 1 then raise exception 'invalid_params'; end if;
    v_t := public.try_uuid(v_params->>'ghost');
    if v_t is null or not exists (
         select 1 from public.players g join public.player_secrets gs on gs.player_id = g.id
         where g.id = v_t and g.room_id = p_room_id and not g.is_alive and gs.team <> 'saboteurs') then
      raise exception 'invalid_target';
    end if;
    if v_tokens < public.room_param(p_room_id, 'cemetery_cost') then raise exception 'not_enough_tokens'; end if;
    v_clean := jsonb_build_object('ghost', v_t);
  elsif p_location = 'cimetiere' then
    if v_params->>'tomb' is not null then
      if public.room_param(p_room_id, 'cemetery_named') = 1 then raise exception 'invalid_params'; end if;
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
    'haunt', (select h.ally_id from public.ghost_haunts h join public.rooms r on r.id = h.room_id
              where h.room_id = p_room_id and h.round = r.round and h.ghost_id = v_ghost.id));
end $$;

create or replace function public.set_ghost_haunt(p_room_id uuid, p_ally uuid, p_player_id uuid default null)
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
  if p_ally is null then
    delete from public.ghost_haunts where room_id = p_room_id and round = v_room.round and ghost_id = v_ghost.id;
    return;
  end if;
  if not exists (select 1 from public.players p join public.player_secrets s on s.player_id = p.id
                 where p.id = p_ally and p.room_id = p_room_id and p.is_alive and s.team = 'saboteurs') then
    raise exception 'invalid_target';
  end if;
  insert into public.ghost_haunts (room_id, round, ghost_id, ally_id)
  values (p_room_id, v_room.round, v_ghost.id, p_ally)
  on conflict (room_id, round, ghost_id) do update set ally_id = excluded.ally_id;
end $$;

-- Vision des Saboteurs : lieux validés des alliés vivants et hantises de la nuit en cours
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
    'allies', coalesce((select jsonb_agg(jsonb_build_object('player_id', p.id, 'location', na.location) order by p.id)
                        from public.players p
                        join public.player_secrets s on s.player_id = p.id and s.team = 'saboteurs'
                        left join public.night_actions na on na.room_id = p_room_id and na.round = v_room.round and na.player_id = p.id
                        where p.room_id = p_room_id and p.is_alive and p.id <> v_me.id), '[]'::jsonb),
    'haunts', coalesce((select jsonb_agg(jsonb_build_object('ghost_id', h.ghost_id, 'ally_id', h.ally_id))
                        from public.ghost_haunts h
                        where h.room_id = p_room_id and h.round = v_room.round), '[]'::jsonb));
end $$;

revoke execute on function public.night_kill(uuid, int, text) from public, anon, authenticated;
revoke execute on function public.set_ghost_haunt(uuid, uuid, uuid) from public, anon;
grant execute on function public.set_ghost_haunt(uuid, uuid, uuid) to authenticated;
revoke execute on function public.get_saboteur_vision(uuid, uuid) from public, anon;
grant execute on function public.get_saboteur_vision(uuid, uuid) to authenticated;
