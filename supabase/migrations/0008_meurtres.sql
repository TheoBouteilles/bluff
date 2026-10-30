-- =====================================================
-- BLUFF : étape 1 des meurtres
--   * Règle de mort par lieu et par nuit (la Maison est protégée) :
--       Saboteurs > Villageois présents : un Villageois meurt à coup sûr
--       égalité (1-1, 2-2...)            : un Villageois meurt avec kill_tie_pct % de chance
--       Villageois > Saboteurs           : personne ne meurt
--     Un mort au maximum par lieu ; les Saboteurs tuent gratuitement.
--   * Annonce à l'aube : le NOM du mort est public, pas le lieu (réglable : death_reveals_location).
--   * Les Villageois survivants d'un lieu où l'on a tué sont « aveuglés » : ils entendent un cri,
--     sans voir qui était là. Les Saboteurs ne sont pas aveuglés.
--   * La Maison ne peut pas être choisie deux nuits de suite.
--   * Les morts (tués ou éliminés au vote) sont des fantômes : ils ne jouent ni ne votent plus.
--   * Victoire des Saboteurs vérifiée dès l'aube.
-- À coller dans Supabase > SQL Editor > New query > Run
-- =====================================================

-- 1. Paramètres (modifiables ici)
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
    when 'kill_tie_pct'     then 50   -- % de mort quand Saboteurs = Villageois dans un lieu
    when 'death_reveals_location' then 0   -- 1 = l'annonce de l'aube indique aussi le lieu du meurtre
    when 'timers_on'        then 0
  end;
$$;

-- 2. Morts de la nuit (le lieu reste secret : aucune lecture côté client)
create table public.night_deaths (
  room_id   uuid not null references public.rooms(id) on delete cascade,
  round     int  not null,
  victim_id uuid not null references public.players(id) on delete cascade,
  location  text not null,
  primary key (room_id, round, victim_id),
  unique (room_id, round, location)
);
alter table public.night_deaths enable row level security;
revoke all on public.night_deaths from anon, authenticated;

-- 3. Choix de la nuit (la Maison pas deux nuits de suite)
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
      if v_stake is null or v_stake < 0 or v_stake > public.game_param('casino_max') then
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
      if v_tokens < public.game_param('don_cost') then raise exception 'not_enough_tokens'; end if;
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
      v_cost := case when v_n = 3 then public.game_param('rumeur3_cost') else public.game_param('rumeur2_cost') end;
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
      if v_tokens < public.game_param('poste_garde_cost') then raise exception 'not_enough_tokens'; end if;
      v_clean := jsonb_build_object('target', v_t);
    end if;

  elsif p_location = 'planque' then
    v_sab := v_params->>'sabotage';
    if v_sab is not null then
      if v_team is distinct from 'saboteurs' then raise exception 'not_saboteur'; end if;
      if v_sab not in ('casino', 'taverne', 'poste_garde') then raise exception 'invalid_location'; end if;
      if v_tokens < public.game_param('planque_cost') then raise exception 'not_enough_tokens'; end if;
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
      if v_tokens < public.game_param('mairie_cost') then raise exception 'not_enough_tokens'; end if;
    end if;
  end if;

  insert into public.night_actions (room_id, round, player_id, location, params)
  values (p_room_id, v_room.round, v_target.id, p_location, v_clean)
  on conflict (room_id, round, player_id)
  do update set location = excluded.location, params = excluded.params, created_at = now();

  perform public.advance_phase(p_room_id, false);
end $$;

-- 4. Résolution de la nuit (meurtres, victoire à l'aube)
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

    elsif a.location = 'mairie' then
      v_rig := a.params->>'rig';
      select count(*) into v_n from public.night_actions na
      where na.room_id = p_room_id and na.round = v_round and na.location = 'mairie';
      if v_rig is not null then
        if public.spend_tokens(a.player_id, public.game_param('mairie_cost')) then
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
      v_kill := k.nb_s > k.nb_v
                or (k.nb_s = k.nb_v and random() * 100 < public.game_param('kill_tie_pct'));
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

-- 5. Dépouillement du vote (les trucages des morts sont ignorés)
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

  -- Voix effectives : votes + trucages de la Mairie (+2 contre une cible ; ou voix contre soi annulées)
  select coalesce(jsonb_object_agg(e.pid, e.c), '{}'::jsonb) into v_tally
  from (
    select u.pid, sum(u.c)::int as c
    from (
      select target_id as pid, count(*)::int as c from public.votes
      where room_id = p_room_id and round = v_round and target_id is not null
      group by target_id
      union all
      select vt.target_id, 2 from public.vote_tampering vt
      join public.players rg on rg.id = vt.player_id and rg.is_alive
      where vt.room_id = p_room_id and vt.round = v_round and vt.kind = 'boost'
    ) u
    where u.pid is not null
      and exists (select 1 from public.players pa where pa.id = u.pid and pa.is_alive)
      and not exists (select 1 from public.vote_tampering sh
                      where sh.room_id = p_room_id and sh.round = v_round
                        and sh.kind = 'shield' and sh.player_id = u.pid)
    group by u.pid
  ) e
  where e.c > 0;

  select max(t.value::int) into v_max from jsonb_each_text(v_tally) t;
  if v_max is not null then
    select count(*) into v_n_top from jsonb_each_text(v_tally) t where t.value::int = v_max;
    if v_n_top = 1 then
      select t.key::uuid into v_elim from jsonb_each_text(v_tally) t where t.value::int = v_max;
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

-- 6. Rapport de l'aube (aveuglement, annonce publique des morts)
create or replace function public.get_dawn_report(p_room_id uuid, p_round int, p_player_id uuid default null)
returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  v_room    public.rooms;
  v_target  public.players;
  v_loc     text;
  v_result  jsonb;
  v_visible boolean;
  v_present jsonb := '[]'::jsonb;
  v_team    text;
  v_killed  boolean := false;
  v_cry     boolean := false;
  v_reveal  boolean := public.game_param('death_reveals_location') = 1;
begin
  select * into v_room from public.rooms where id = p_room_id;
  if not found then raise exception 'room_not_found'; end if;

  v_target := public.resolve_target(p_room_id, p_player_id);

  if p_round > v_room.round or (p_round = v_room.round and v_room.phase = 'night') then
    raise exception 'night_not_over';
  end if;

  select location, result into v_loc, v_result from public.night_actions
  where room_id = p_room_id and round = p_round and player_id = v_target.id;

  select team into v_team from public.player_secrets where player_id = v_target.id;

  -- Cette nuit-là : suis-je la victime ? Un meurtre a-t-il eu lieu là où j'étais ?
  v_killed := exists (select 1 from public.night_deaths d
                      where d.room_id = p_room_id and d.round = p_round and d.victim_id = v_target.id);
  v_cry := not v_killed and v_loc is not null and exists (
             select 1 from public.night_deaths d
             where d.room_id = p_room_id and d.round = p_round and d.location = v_loc);

  if v_loc is not null then
    select visible_crossing into v_visible from public.locations where id = v_loc;
    -- Les gentils d'un lieu où l'on a tué sont aveuglés : ils n'entendent qu'un cri
    if v_visible and not (v_cry and v_team is distinct from 'saboteurs') and not v_killed then
      select coalesce(jsonb_agg(a.player_id order by a.created_at), '[]'::jsonb) into v_present
      from public.night_actions a
      where a.room_id = p_room_id and a.round = p_round
        and a.location = v_loc and a.player_id <> v_target.id;
    end if;
  end if;

  return jsonb_build_object(
    'location', v_loc,
    'present', v_present,
    'result', coalesce(v_result, '{}'::jsonb),
    'cry', v_cry and v_team is distinct from 'saboteurs',
    'killed', v_killed,
    'deaths', coalesce((select jsonb_agg(jsonb_build_object(
                          'player_id', d.victim_id,
                          'location', case when v_reveal then d.location else null end)
                        order by d.victim_id)
                        from public.night_deaths d
                        where d.room_id = p_room_id and d.round = p_round), '[]'::jsonb),
    'closed_next', coalesce((select jsonb_agg(c.location order by c.location)
                             from public.closures c
                             where c.room_id = p_room_id and c.round = p_round + 1), '[]'::jsonb));
end $$;

-- 7. Retour au salon : on efface aussi les morts de la nuit
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
  set status = 'lobby', round = 0, phase = 'lobby', phase_ends_at = null, winner = null
  where id = p_room_id;
end $$;
