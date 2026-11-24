-- 0023 : réglages revus après les parties tests à 4, 5 et 6 joueurs (lot B)
--   - Meurtre à égalité Saboteurs / autres : 60 % par défaut (au lieu de 50 %).
--   - Casino : 60 % de chances de gagner par défaut (au lieu de 50 %).
--   - Égalité au vote : 2 revotes au plus (au lieu de 3), puis tirage au sort.
--   - Taverne : avec un seul Saboteur dans la partie, la rumeur vise toujours 3 joueurs, au prix de 3 jetons
--     (réglage rumeur_solo_only). Remplace la « petite partie » qui dépendait du nombre de joueurs
--     (rumeur_small_max_players, supprimé). Le prix reste rumeur_small_cost (3 par défaut au lieu de 4).
--   - Poste de garde : 2 jetons avec un seul Saboteur (poste_garde_cost), 1 jeton à 2 Saboteurs ou plus
--     (nouveau réglage poste_garde_cost_multi).
--   - Mairie : l'option « protection » (kind 'shield') retire désormais mairie_boost voix contre soi
--     au premier dépouillement, au lieu d'annuler toutes les voix reçues.
-- À garder aligné avec src/data/settings.ts et src/data/costs.ts.

-- 1. Valeurs par défaut
create or replace function public.game_param(p_key text)
returns integer
language sql
immutable
set search_path = public
as $$
  select case p_key
    when 'poste_garde_cost' then 2     -- avec un seul Saboteur dans la partie
    when 'poste_garde_cost_multi' then 1 -- avec 2 Saboteurs ou plus
    when 'planque_cost'     then 2
    when 'rumeur3_cost'     then 2
    when 'rumeur2_cost'     then 3
    when 'don_cost'         then 1
    when 'casino_max'       then 3
    when 'casino_win_pct'   then 60
    when 'mairie_cost'      then 2
    when 'kill_majority_pct' then 100  -- Saboteurs > Villageois dans un lieu
    when 'kill_tie_pct'     then 60    -- Saboteurs = Villageois
    when 'kill_minority_pct' then 0    -- Saboteurs < Villageois (au moins un Saboteur présent)
    when 'death_reveals_location' then 0
    when 'tokens_start_villager'  then 1
    when 'tokens_start_saboteur'  then 2   -- chaque Saboteur, quand ils sont plusieurs
    when 'tokens_start_saboteur_solo' then 3 -- Saboteur seul
    when 'tokens_income_villager' then 1   -- jetons gagnés chaque nuit (à partir de la nuit 2)
    when 'tokens_income_saboteur' then 1
    when 'saboteurs_count'  then 0     -- 0 = automatique (1 jusqu'à 5 joueurs, 2 à partir de 6)
    when 'vote_runoff_max'  then 2     -- nombre de nouveaux votes en cas d'égalité
    when 'cemetery_cost'    then 1     -- coût pour choisir une tombe au Cimetière
    when 'tomb_count'       then 3     -- nombre de tombes
    when 'mairie_boost'     then 1     -- voix ajoutées (ou retirées contre soi) par un trucage réussi à la Mairie
    when 'rumeur_solo_only' then 1     -- 1 = avec un seul Saboteur, rumeur sur 3 joueurs uniquement
    when 'rumeur_small_cost' then 3    -- prix de cette rumeur
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
    when 'solitaires_on'         then 1  -- 1 = Solitaires distribués selon le nombre de joueurs, 0 = jamais
    when 'solitaire1_min_players' then 7 -- 1 Solitaire à partir de ce nombre de joueurs
    when 'solitaire2_min_players' then 8 -- 2 Solitaires à partir de ce nombre de joueurs
    when 'capitaliste_goal'      then 10 -- jetons à détenir pour la victoire du Capitaliste
    when 'opportuniste_switch_cost' then 2 -- coût pour changer de camp (le premier choix est gratuit)
  end;
$$;

-- 2. Bornes (la liste des réglages modifiables)
create or replace function public.setting_bounds()
returns table(key text, lo integer, hi integer)
language sql
immutable
set search_path = public
as $$
  values
    ('saboteurs_count', 0, 4), ('tokens_start_villager', 0, 10), ('tokens_start_saboteur', 0, 10),
    ('tokens_income_villager', 0, 5), ('tokens_income_saboteur', 0, 5),
    ('kill_majority_pct', 0, 100), ('kill_tie_pct', 0, 100), ('kill_minority_pct', 0, 100),
    ('death_reveals_location', 0, 1),
    ('poste_garde_cost', 0, 9), ('poste_garde_cost_multi', 0, 9),
    ('planque_cost', 0, 9), ('rumeur3_cost', 0, 9), ('rumeur2_cost', 0, 9),
    ('don_cost', 0, 9), ('mairie_cost', 0, 9), ('casino_max', 0, 9), ('casino_win_pct', 0, 100),
    ('cemetery_cost', 0, 9), ('tomb_count', 2, 6),
    ('mairie_boost', 1, 3), ('rumeur_solo_only', 0, 1), ('rumeur_small_cost', 0, 9), ('sudden_death_on', 0, 1),
    ('tokens_start_saboteur_solo', 0, 10),
    ('timers_on', 0, 1), ('night_seconds', 30, 600), ('day_seconds', 30, 900), ('vote_seconds', 30, 600),
    ('casino_sabotage_steal', 0, 1), ('planque_kill_first', 0, 1), ('cemetery_named', 0, 1),
    ('ghost_haunt_on', 0, 1), ('ghost_haunt_bonus_pct', 0, 100), ('saboteur_vision', 0, 1),
    ('vote_runoff_max', 0, 9),
    ('solitaires_on', 0, 1), ('solitaire1_min_players', 4, 10), ('solitaire2_min_players', 4, 10),
    ('capitaliste_goal', 3, 30), ('opportuniste_switch_cost', 0, 9)
$$;

-- L'ancien réglage « petite partie » n'existe plus : on le retire des salons qui l'avaient modifié
update public.room_settings set vals = vals - 'rumeur_small_max_players' where vals ? 'rumeur_small_max_players';

-- 3. Nombre de Saboteurs distribués dans la partie (morts compris)
create or replace function public.saboteur_total(p_room uuid)
returns int
language sql stable security definer set search_path = public as $$
  select count(*)::int
  from public.player_secrets s
  join public.players p on p.id = s.player_id
  where p.room_id = p_room and s.team = 'saboteurs';
$$;

-- 4. Taverne : avec un seul Saboteur, rumeur sur 3 joueurs uniquement (au prix rumeur_small_cost).
--    rumeur_small garde son nom : submit_night_action et rumeur_cost l'utilisent déjà.
create or replace function public.rumeur_small(p_room uuid)
returns boolean
language sql stable security definer set search_path = public as $$
  select public.room_param(p_room, 'rumeur_solo_only') = 1 and public.saboteur_total(p_room) = 1;
$$;

-- 5. Poste de garde : prix selon le nombre de Saboteurs
create or replace function public.poste_cost(p_room uuid)
returns int
language sql stable security definer set search_path = public as $$
  select case when public.saboteur_total(p_room) >= 2 then public.room_param(p_room, 'poste_garde_cost_multi')
              else public.room_param(p_room, 'poste_garde_cost') end;
$$;

-- submit_night_action (vérification des jetons) et resolve_night (paiement) lisaient poste_garde_cost
-- directement : on remplace cet appel dans leur définition actuelle, sans recopier ces longues fonctions.
do $$
declare
  f   regprocedure;
  def text;
  old text := 'public.room_param(p_room_id, ''poste_garde_cost'')';
begin
  foreach f in array array['public.resolve_night(uuid)'::regprocedure,
                           'public.submit_night_action(uuid, text, uuid, jsonb)'::regprocedure] loop
    def := pg_get_functiondef(f);
    if position(old in def) = 0 then raise exception 'poste_garde_cost introuvable dans %', f; end if;
    execute replace(def, old, 'public.poste_cost(p_room_id)');
  end loop;
end $$;

-- 6. Mairie : la protection retire mairie_boost voix contre soi (au premier dépouillement)
create or replace function public.resolve_vote(p_room_id uuid)
returns void
language plpgsql security definer set search_path = public as $$
declare
  v_round  int;
  v_step   int;
  v_cands  uuid[];
  r        record;
  v_max    int;
  v_n_top  int;
  v_elim   uuid;
  v_team   text;
  v_tally  jsonb;
  v_win    text;
  v_tied   uuid[];
  v_runmax int := public.room_param(p_room_id, 'vote_runoff_max');
  v_drawn  boolean := false;
begin
  select round, vote_step, vote_candidates into v_round, v_step, v_cands
  from public.rooms where id = p_room_id;

  -- Joueurs sans vote : les bots votent au hasard (parmi les candidats d'un départage), les humains s'abstiennent
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
                         and (v_cands is null or p2.id = any(v_cands))
                       order by random() limit 1)
                 else null end);
  end loop;

  -- Voix effectives. Les trucages de la Mairie ne comptent qu'au premier décompte :
  -- boost = +mairie_boost contre la cible, shield = -mairie_boost contre soi, backfire = +1 contre le tricheur.
  select coalesce(jsonb_object_agg(e.pid, e.c), '{}'::jsonb) into v_tally
  from (
    select u.pid, sum(u.c)::int as c
    from (
      select target_id as pid, count(*)::int as c from public.votes
      where room_id = p_room_id and round = v_round and target_id is not null
      group by target_id
      union all
      select vt.target_id, public.room_param(p_room_id, 'mairie_boost') from public.vote_tampering vt
      join public.players rg on rg.id = vt.player_id and rg.is_alive
      where vt.room_id = p_room_id and vt.round = v_round and vt.kind = 'boost' and v_step = 0
      union all
      select vt.player_id, -public.room_param(p_room_id, 'mairie_boost') from public.vote_tampering vt
      join public.players rg on rg.id = vt.player_id and rg.is_alive
      where vt.room_id = p_room_id and vt.round = v_round and vt.kind = 'shield' and v_step = 0
      union all
      select vt.player_id, 1 from public.vote_tampering vt
      join public.players rg on rg.id = vt.player_id and rg.is_alive
      where vt.room_id = p_room_id and vt.round = v_round and vt.kind = 'backfire' and v_step = 0
    ) u
    where u.pid is not null
      and exists (select 1 from public.players pa where pa.id = u.pid and pa.is_alive)
    group by u.pid
  ) e
  where e.c > 0;

  select max(t.value::int) into v_max from jsonb_each_text(v_tally) t;
  if v_max is not null then
    select array_agg(t.key::uuid) into v_tied from jsonb_each_text(v_tally) t where t.value::int = v_max;
    v_n_top := cardinality(v_tied);
    if v_n_top = 1 then
      v_elim := v_tied[1];
    elsif v_step < v_runmax then
      -- Égalité : nouveau vote entre les joueurs à égalité
      insert into public.vote_runoffs (room_id, round, step, candidates, tally)
      values (p_room_id, v_round, v_step + 1, v_tied, v_tally);
      delete from public.votes where room_id = p_room_id and round = v_round;
      update public.rooms
      set vote_step = v_step + 1, vote_candidates = v_tied, phase_ends_at = null
      where id = p_room_id;
      return;
    elsif v_runmax > 0 then
      -- Départages épuisés : tirage au sort parmi les joueurs à égalité
      v_elim := v_tied[1 + floor(random() * v_n_top)::int];
      v_drawn := true;
    end if;
  end if;

  if v_elim is not null then
    update public.players set is_alive = false where id = v_elim;
    select team into v_team from public.player_secrets where player_id = v_elim;
  end if;

  insert into public.vote_results (room_id, round, eliminated_id, eliminated_team, tied, tally, runoffs, drawn)
  values (p_room_id, v_round, v_elim, v_team, (v_max is not null and v_elim is null), v_tally, v_step, v_drawn);

  v_win := public.update_victory(p_room_id, true);

  update public.rooms
  set phase = case when v_win is null then 'result' else 'ended' end,
      winner = v_win,
      vote_step = 0,
      vote_candidates = null,
      phase_ends_at = null
  where id = p_room_id;
end $$;

-- 7. Droits : fonctions internes non exécutables par les clients (règle de la revue 0020)
revoke all on function public.saboteur_total(uuid), public.poste_cost(uuid),
  public.rumeur_small(uuid), public.resolve_vote(uuid), public.resolve_night(uuid)
  from public, anon, authenticated;
revoke all on function public.submit_night_action(uuid, text, uuid, jsonb) from public, anon;
grant execute on function public.submit_night_action(uuid, text, uuid, jsonb) to authenticated;
