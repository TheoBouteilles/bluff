-- =====================================================
-- BLUFF : étape 3b (effets des lieux)
--   Casino      : miser 1 à 3 jetons, 50 % de doubler
--   Taverne     : donner 1 jeton (secret) ou acheter une rumeur
--   Poste Garde : savoir où un joueur a passé la nuit (2 jetons)
--   Planque     : sabotage d'un lieu pour la nuit suivante (Saboteurs, 2 jetons)
-- À coller dans Supabase > SQL Editor > New query > Run
-- =====================================================

-- 1. Paramètres du jeu (modifiables ici ; à garder alignés avec src/data/costs.ts)
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
  end;
$$;

-- 2. Conversions sûres (renvoient null au lieu de planter)
create or replace function public.try_int(p text)
returns int language plpgsql immutable as $$
begin
  return p::int;
exception when others then
  return null;
end $$;

create or replace function public.try_uuid(p text)
returns uuid language plpgsql immutable as $$
begin
  return p::uuid;
exception when others then
  return null;
end $$;

-- 3. Colonnes : paramètres choisis et résultat privé de chaque action
alter table public.night_actions
  add column params jsonb not null default '{}'::jsonb,
  add column result jsonb not null default '{}'::jsonb;

-- 4. Lieux fermés (sabotage) : fermé pendant la manche indiquée
create table public.closures (
  room_id  uuid not null references public.rooms(id) on delete cascade,
  round    int  not null,
  location text not null references public.locations(id),
  primary key (room_id, round, location)
);
alter table public.closures enable row level security;
revoke insert, update, delete on public.closures from anon, authenticated;
create policy "membres lisent les fermetures" on public.closures
  for select to authenticated using (public.is_room_member(room_id));

-- 5. Outils internes
create or replace function public.spend_tokens(p_player uuid, p_amount int)
returns boolean
language plpgsql security definer set search_path = public as $$
begin
  update public.player_secrets set tokens = tokens - p_amount
  where player_id = p_player and tokens >= p_amount;
  return found;
end $$;

create or replace function public.add_night_result(p_room uuid, p_round int, p_player uuid, p_patch jsonb)
returns void
language sql security definer set search_path = public as $$
  update public.night_actions set result = result || p_patch
  where room_id = p_room and round = p_round and player_id = p_player;
$$;

-- 6. Choisir son lieu et ses options (l'hôte debug peut le faire pour un bot)
drop function public.submit_night_action(uuid, text, uuid);

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
  end if;

  insert into public.night_actions (room_id, round, player_id, location, params)
  values (p_room_id, v_room.round, v_target.id, p_location, v_clean)
  on conflict (room_id, round, player_id)
  do update set location = excluded.location, params = excluded.params, created_at = now();

  perform public.advance_phase(p_room_id, false);
end $$;

-- 7. Résolution de la nuit : applique les effets de tous les lieux
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
        if public.spend_tokens(a.player_id, v_cost) then
          update public.player_secrets set tokens = tokens + v_cost where player_id = v_target;
          perform public.add_night_result(p_room_id, v_round, a.player_id,
            jsonb_build_object('don', jsonb_build_object('target', v_target, 'amount', v_cost)));
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

-- 8. Rapport de l'aube : lieu, croisements, résultat privé, lieux fermés pour la nuit prochaine
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
begin
  select * into v_room from public.rooms where id = p_room_id;
  if not found then raise exception 'room_not_found'; end if;

  v_target := public.resolve_target(p_room_id, p_player_id);

  if p_round > v_room.round or (p_round = v_room.round and v_room.phase = 'night') then
    raise exception 'night_not_over';
  end if;

  select location, result into v_loc, v_result from public.night_actions
  where room_id = p_room_id and round = p_round and player_id = v_target.id;

  if v_loc is not null then
    select visible_crossing into v_visible from public.locations where id = v_loc;
    if v_visible then
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
    'closed_next', coalesce((select jsonb_agg(c.location order by c.location)
                             from public.closures c
                             where c.room_id = p_room_id and c.round = p_round + 1), '[]'::jsonb));
end $$;

-- 9. Retour au salon : on efface aussi les fermetures
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

  delete from public.closures where room_id = p_room_id;
  delete from public.night_actions where room_id = p_room_id;
  delete from public.player_secrets
  where player_id in (select id from public.players where room_id = p_room_id);
  update public.players set is_alive = true where room_id = p_room_id;
  update public.rooms
  set status = 'lobby', round = 0, phase = 'lobby', phase_ends_at = null
  where id = p_room_id;
end $$;

-- 10. Droits d'exécution
revoke execute on function
  public.game_param(text),
  public.try_int(text),
  public.try_uuid(text),
  public.spend_tokens(uuid, int),
  public.add_night_result(uuid, int, uuid, jsonb)
from public, anon, authenticated;

revoke execute on function public.submit_night_action(uuid, text, uuid, jsonb) from public, anon;
grant  execute on function public.submit_night_action(uuid, text, uuid, jsonb) to authenticated;
