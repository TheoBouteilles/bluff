-- Tests des scénarios clés de Bluff, à relancer après chaque migration qui touche aux règles.
-- Exécution : coller tout le fichier dans Supabase > SQL Editor (ou via le connecteur Supabase).
-- Tout se passe dans une transaction ANNULÉE à la fin : rien n'est gardé en base.
-- Résultat : le script se termine toujours par une erreur volontaire (c'est ce qui annule tout) :
--   « TESTS OK : n vérifications réussies »  → tout va bien
--   « ÉCHEC [nom du test] : … »             → une règle ne se comporte plus comme prévu
-- Prérequis : au moins 8 comptes dans auth.users (les sessions anonymes des joueurs suffisent).
-- Le test 8 passe temporairement un compte en « non invité » (annulé avec le reste).

begin;

-- Crée un salon de n joueurs humains (comptes existants) ; renvoie [salon, joueur 1 (hôte), joueur 2, …]
create function pg_temp.mkroom(p_code text, p_n int, p_settings jsonb default '{}') returns uuid[]
language plpgsql as $$
declare u uuid[]; rid uuid; pid uuid; ids uuid[];
begin
  select array_agg(id) into u from (select id from auth.users order by created_at limit p_n) x;
  if coalesce(cardinality(u), 0) < p_n then raise exception 'Pas assez de comptes dans auth.users (% requis)', p_n; end if;
  insert into public.rooms (code, debug) values (p_code, false) returning id into rid;
  ids := array[rid];
  for i in 1..p_n loop
    insert into public.players (room_id, user_id, nickname, avatar, is_host)
    values (rid, u[i], 'T' || i, i - 1, i = 1) returning id into pid;
    ids := ids || pid;
  end loop;
  insert into public.room_settings (room_id, vals) values (rid, p_settings);
  return ids;
end $$;

-- Agit en tant que l'utilisateur d'un joueur (pour auth.uid() dans les RPC)
create function pg_temp.as_player(p_player uuid) returns void language sql as $$
  select set_config('request.jwt.claims',
    json_build_object('sub', (select user_id from public.players where id = p_player), 'role', 'authenticated')::text, true);
$$;

-- Fixe les rôles et jetons après le lancement (le tirage est aléatoire)
create function pg_temp.set_role(p_player uuid, p_role text, p_tokens int default 5) returns void language sql as $$
  update public.player_secrets set role_id = p_role, team = public.role_team(p_role), tokens = p_tokens, side = null, solo_won = false
  where player_id = p_player;
$$;

do $tests$
declare
  ok int := 0;
  r uuid[]; rid uuid;
  v_txt text; v_int int; v_bool boolean;
begin
  ---------------------------------------------------------------------------
  -- 1. Distribution des rôles
  ---------------------------------------------------------------------------
  r := pg_temp.mkroom('TQAA', 6); perform pg_temp.as_player(r[2]); perform public.start_game(r[1]);
  select count(*) into v_int from public.player_secrets s join public.players p on p.id = s.player_id where p.room_id = r[1] and s.team = 'solitaires';
  if v_int <> 0 then raise exception 'ÉCHEC [distribution 6 j.] : % Solitaire(s) au lieu de 0', v_int; end if; ok := ok + 1;
  select count(*) into v_int from public.player_secrets s join public.players p on p.id = s.player_id where p.room_id = r[1] and s.team = 'saboteurs';
  if v_int <> 2 then raise exception 'ÉCHEC [distribution 6 j.] : % Saboteur(s) au lieu de 2', v_int; end if; ok := ok + 1;

  r := pg_temp.mkroom('TQAB', 8); perform pg_temp.as_player(r[2]); perform public.start_game(r[1]);
  select count(*) into v_int from public.player_secrets s join public.players p on p.id = s.player_id where p.room_id = r[1] and s.team = 'solitaires';
  if v_int <> 2 then raise exception 'ÉCHEC [distribution 8 j.] : % Solitaire(s) au lieu de 2', v_int; end if; ok := ok + 1;

  r := pg_temp.mkroom('TQAC', 8, '{"solitaires_on": 0}'); perform pg_temp.as_player(r[2]); perform public.start_game(r[1]);
  select count(*) into v_int from public.player_secrets s join public.players p on p.id = s.player_id where p.room_id = r[1] and s.team = 'solitaires';
  if v_int <> 0 then raise exception 'ÉCHEC [Solitaires désactivés] : % Solitaire(s)', v_int; end if; ok := ok + 1;

  ---------------------------------------------------------------------------
  -- 2. Nuit : meurtre, maison protégée, lieu sans Saboteur
  --    5 joueurs : T1 Saboteur ; taverne T1+T2 (égalité, réglée à 100 %) ; maison T3 ; casino T4+T5
  ---------------------------------------------------------------------------
  r := pg_temp.mkroom('TQBA', 5, '{"kill_tie_pct": 100}'); rid := r[1];
  perform pg_temp.as_player(r[2]); perform public.start_game(rid);
  perform pg_temp.set_role(r[2], 'saboteur_simple');
  for i in 3..6 loop perform pg_temp.set_role(r[i], 'villageois_simple'); end loop;
  insert into public.night_actions (room_id, round, player_id, location) values
    (rid, 1, r[2], 'taverne'), (rid, 1, r[3], 'taverne'), (rid, 1, r[4], 'maison'), (rid, 1, r[5], 'casino'), (rid, 1, r[6], 'casino');
  perform public.resolve_night(rid);
  if not exists (select 1 from public.night_deaths where room_id = rid and victim_id = r[3] and location = 'taverne') then
    raise exception 'ÉCHEC [meurtre à égalité 100 %%] : T2 n''est pas mort à la taverne'; end if; ok := ok + 1;
  select count(*) into v_int from public.night_deaths where room_id = rid;
  if v_int <> 1 then raise exception 'ÉCHEC [un seul meurtre] : % mort(s)', v_int; end if; ok := ok + 1;
  select phase into v_txt from public.rooms where id = rid;
  if v_txt <> 'day' then raise exception 'ÉCHEC [aube] : phase % au lieu de day', v_txt; end if; ok := ok + 1;

  -- Rapport d'aube : T3 (maison, lieu discret) ne voit personne ; T5 voit T4 au casino
  perform pg_temp.as_player(r[4]);
  if (public.get_dawn_report(rid, 1, null)->'present')::text <> '[]' then
    raise exception 'ÉCHEC [maison discrète] : des présents sont visibles'; end if; ok := ok + 1;
  perform pg_temp.as_player(r[6]);
  if not ((public.get_dawn_report(rid, 1, null)->'present') ? r[5]::text) then
    raise exception 'ÉCHEC [croisement visible] : T5 ne voit pas T4 au casino'; end if; ok := ok + 1;

  ---------------------------------------------------------------------------
  -- 3. Vote : égalité → départage, puis élimination du Saboteur → victoire des Villageois
  ---------------------------------------------------------------------------
  update public.rooms set phase = 'vote' where id = rid;
  insert into public.votes (room_id, round, voter_id, target_id) values
    (rid, 1, r[2], r[6]), (rid, 1, r[4], r[2]), (rid, 1, r[5], r[6]), (rid, 1, r[6], r[2]);
  perform public.resolve_vote(rid);
  select vote_step into v_int from public.rooms where id = rid;
  if v_int <> 1 then raise exception 'ÉCHEC [départage] : vote_step = % au lieu de 1', v_int; end if; ok := ok + 1;
  if exists (select 1 from public.votes where room_id = rid and round = 1) then
    raise exception 'ÉCHEC [départage] : les anciens votes n''ont pas été effacés'; end if; ok := ok + 1;

  perform pg_temp.as_player(r[4]);
  begin
    perform public.submit_vote(rid, r[5], null); -- T3 vote pour T4, qui n'est pas ex æquo
    raise exception 'ÉCHEC [départage] : vote accepté pour un non-candidat';
  exception when others then
    if sqlerrm not like '%invalid_target%' then raise; end if;
  end; ok := ok + 1;

  insert into public.votes (room_id, round, voter_id, target_id) values
    (rid, 1, r[2], r[6]), (rid, 1, r[4], r[2]), (rid, 1, r[5], r[2]), (rid, 1, r[6], r[2]);
  perform public.resolve_vote(rid);
  select winner into v_txt from public.rooms where id = rid;
  if v_txt is distinct from 'villageois' then raise exception 'ÉCHEC [victoire Villageois] : vainqueur %', v_txt; end if; ok := ok + 1;
  if not exists (select 1 from public.game_history where room_id = rid and ended_by = 'vote' and winner = 'villageois') then
    raise exception 'ÉCHEC [statistiques] : partie non enregistrée dans game_history'; end if; ok := ok + 1;
  select count(*) into v_int from public.player_game_stats s join public.game_history g on g.id = s.game_id where g.room_id = rid;
  if v_int <> 5 then raise exception 'ÉCHEC [statistiques] : % ligne(s) joueur au lieu de 5', v_int; end if; ok := ok + 1;

  ---------------------------------------------------------------------------
  -- 4. Mairie : deux joueurs présents → trucage raté, jetons perdus
  ---------------------------------------------------------------------------
  r := pg_temp.mkroom('TQCA', 5); rid := r[1];
  perform pg_temp.as_player(r[2]); perform public.start_game(rid);
  perform pg_temp.set_role(r[2], 'saboteur_simple');
  for i in 3..6 loop perform pg_temp.set_role(r[i], 'villageois_simple'); end loop;
  insert into public.night_actions (room_id, round, player_id, location, params) values
    (rid, 1, r[3], 'mairie', jsonb_build_object('rig', 'boost', 'target', r[2])),
    (rid, 1, r[4], 'mairie', '{}'), (rid, 1, r[2], 'maison', '{}'), (rid, 1, r[5], 'maison', '{}'), (rid, 1, r[6], 'maison', '{}');
  perform public.resolve_night(rid);
  if exists (select 1 from public.vote_tampering where room_id = rid) then
    raise exception 'ÉCHEC [Mairie bondée] : le trucage a été enregistré'; end if; ok := ok + 1;
  select tokens into v_int from public.player_secrets where player_id = r[3];
  if v_int <> 3 then raise exception 'ÉCHEC [Mairie bondée] : % jeton(s) au lieu de 3 (5 - 2)', v_int; end if; ok := ok + 1;

  ---------------------------------------------------------------------------
  -- 5. 1 Saboteur contre 1 seul autre joueur → victoire immédiate des Saboteurs
  ---------------------------------------------------------------------------
  r := pg_temp.mkroom('TQDA', 4, '{"kill_tie_pct": 100}'); rid := r[1];
  perform pg_temp.as_player(r[2]); perform public.start_game(rid);
  perform pg_temp.set_role(r[2], 'saboteur_simple');
  for i in 3..5 loop perform pg_temp.set_role(r[i], 'villageois_simple'); end loop;
  update public.players set is_alive = false where id = r[5];            -- T4 déjà mort
  insert into public.night_actions (room_id, round, player_id, location) values
    (rid, 1, r[2], 'taverne'), (rid, 1, r[3], 'taverne'), (rid, 1, r[4], 'maison');
  perform public.resolve_night(rid);                                       -- T2 meurt : 1 contre 1
  select winner into v_txt from public.rooms where id = rid;
  if v_txt is distinct from 'saboteurs' then raise exception 'ÉCHEC [1 contre 1] : vainqueur %', coalesce(v_txt, 'aucun'); end if; ok := ok + 1;

  ---------------------------------------------------------------------------
  -- 6. Solitaires : objectif du Capitaliste, pari de l'Opportuniste
  ---------------------------------------------------------------------------
  r := pg_temp.mkroom('TQEA', 8); rid := r[1];
  perform pg_temp.as_player(r[2]); perform public.start_game(rid);
  perform pg_temp.set_role(r[2], 'saboteur_simple'); perform pg_temp.set_role(r[3], 'saboteur_simple');
  perform pg_temp.set_role(r[4], 'capitaliste', 9); perform pg_temp.set_role(r[5], 'opportuniste', 3);
  for i in 6..9 loop perform pg_temp.set_role(r[i], 'villageois_simple'); end loop;
  update public.player_secrets set tokens = 10 where player_id = r[4];
  update public.player_secrets set tokens = 2 where player_id = r[4];
  select solo_won into v_bool from public.player_secrets where player_id = r[4];
  if not v_bool then raise exception 'ÉCHEC [Capitaliste] : objectif atteint non acquis'; end if; ok := ok + 1;
  perform pg_temp.as_player(r[5]);
  perform public.set_opportunist_side(rid, 'saboteurs', null);
  perform public.set_opportunist_side(rid, 'villageois', null);
  select tokens into v_int from public.player_secrets where player_id = r[5];
  if v_int <> 1 then raise exception 'ÉCHEC [Opportuniste] : % jeton(s) au lieu de 1 (changement à 2)', v_int; end if; ok := ok + 1;
  update public.rooms set phase = 'ended', status = 'ended', winner = 'villageois' where id = rid;
  select solo_won into v_bool from public.player_secrets where player_id = r[5];
  if not v_bool then raise exception 'ÉCHEC [Opportuniste] : pari gagnant non reconnu'; end if; ok := ok + 1;

  ---------------------------------------------------------------------------
  -- 7. Sécurité
  ---------------------------------------------------------------------------
  r := pg_temp.mkroom('TQFA', 5); rid := r[1];
  perform pg_temp.as_player(r[2]); perform public.start_game(rid);

  perform pg_temp.as_player(r[3]);                                         -- T2, pas hôte
  begin
    perform public.advance_phase(rid, true);
    raise exception 'ÉCHEC [sécurité] : un non-hôte a forcé la phase';
  exception when others then if sqlerrm not like '%not_host%' then raise; end if;
  end; ok := ok + 1;

  begin
    perform public.submit_night_action(rid, 'maison', r[4], '{}');           -- agir pour T3 (humain)
    raise exception 'ÉCHEC [sécurité] : action acceptée pour un autre joueur';
  exception when others then if sqlerrm not like '%invalid_target%' then raise; end if;
  end; ok := ok + 1;

  begin
    perform public.get_dawn_report(rid, 1, r[4]);                          -- lire le rapport de T3
    raise exception 'ÉCHEC [sécurité] : rapport d''un autre joueur lisible';
  exception when others then if sqlerrm not like '%invalid_target%' and sqlerrm not like '%night_not_over%' then raise; end if;
  end; ok := ok + 1;

  -- Lecture directe des tables avec les droits d'un joueur (RLS)
  set local role authenticated;
  select count(*) into v_int from public.player_secrets s join public.players p on p.id = s.player_id where p.room_id = rid;
  reset role;
  if v_int <> 1 then raise exception 'ÉCHEC [sécurité RLS] : % secret(s) lisible(s) au lieu du sien', v_int; end if; ok := ok + 1;

  set local role authenticated;
  select count(*) into v_int from public.game_history;
  reset role;
  if v_int <> 0 then raise exception 'ÉCHEC [sécurité RLS] : historique lisible directement'; end if; ok := ok + 1;

  -- Partie lancée : un nouveau venu ne peut pas rejoindre
  perform set_config('request.jwt.claims', json_build_object('sub',
    (select id from auth.users where id not in (select user_id from public.players where room_id = rid and user_id is not null) limit 1),
    'role', 'authenticated')::text, true);
  begin
    perform public.join_room('TQFA', 'Intrus');
    raise exception 'ÉCHEC [sécurité] : un nouveau joueur a rejoint une partie lancée';
  exception when others then if sqlerrm not like '%game_started%' then raise; end if;
  end; ok := ok + 1;

  ---------------------------------------------------------------------------
  -- 8. Profils et fusion invité → compte (migration 0021)
  ---------------------------------------------------------------------------
  r := pg_temp.mkroom('TQGA', 2); rid := r[1];                              -- T1 = invité, T2 = futur compte
  perform pg_temp.as_player(r[2]);
  if (public.save_my_profile('Profil', 3, '{"t":2,"a":5,"x":9}', '{"audio":{"music":true}}')->'look')::text <> '{"a": 5, "t": 2}' then
    raise exception 'ÉCHEC [profil] : apparence mal nettoyée'; end if; ok := ok + 1;
  v_txt := (public.create_room('Profil', false))->>'room_id';
  if (select avatar from public.players where room_id = v_txt::uuid) <> 3 then
    raise exception 'ÉCHEC [profil] : avatar du profil non appliqué en entrant dans un salon'; end if; ok := ok + 1;
  perform public.save_my_profile(null, 7, null, null);
  if (select avatar from public.players where room_id = v_txt::uuid) <> 7 then
    raise exception 'ÉCHEC [profil] : avatar non mis à jour dans le salon d''attente'; end if; ok := ok + 1;
  v_txt := public.create_merge_ticket();
  update auth.users set is_anonymous = false where id = (select user_id from public.players where id = r[3]);
  perform pg_temp.as_player(r[3]);
  if public.create_merge_ticket() is not null then
    raise exception 'ÉCHEC [fusion] : un compte (non invité) a pu créer un ticket'; end if; ok := ok + 1;
  if not (public.claim_merge_ticket(v_txt)->>'merged')::boolean then
    raise exception 'ÉCHEC [fusion] : le ticket de l''invité n''a pas été accepté'; end if; ok := ok + 1;
  if (public.claim_merge_ticket(v_txt)->>'merged')::boolean then
    raise exception 'ÉCHEC [fusion] : un ticket a servi deux fois'; end if; ok := ok + 1;
  if (public.get_my_profile()->>'avatar')::int <> 7 then
    raise exception 'ÉCHEC [fusion] : profil de l''invité non rapatrié'; end if; ok := ok + 1;

  ---------------------------------------------------------------------------
  -- 9. Récap de fin de partie (migration 0022)
  --    5 joueurs : T1 Saboteur tue T2 à la taverne ; T3 mise 3 au Casino (gain garanti)
  ---------------------------------------------------------------------------
  r := pg_temp.mkroom('TQHA', 5, '{"kill_tie_pct": 100, "casino_win_pct": 100}'); rid := r[1];
  perform pg_temp.as_player(r[2]); perform public.start_game(rid);
  perform pg_temp.set_role(r[2], 'saboteur_simple');
  for i in 3..6 loop perform pg_temp.set_role(r[i], 'villageois_simple'); end loop;
  begin
    perform public.get_game_recap(rid);
    raise exception 'ÉCHEC [récap] : lisible avant la fin de partie';
  exception when others then if sqlerrm not like '%not_ended%' then raise; end if;
  end; ok := ok + 1;
  insert into public.night_actions (room_id, round, player_id, location, params) values
    (rid, 1, r[2], 'taverne', '{}'), (rid, 1, r[3], 'taverne', '{}'), (rid, 1, r[4], 'casino', '{"stake":3}'),
    (rid, 1, r[5], 'maison', '{}'), (rid, 1, r[6], 'casino', '{"stake":0}');
  perform public.resolve_night(rid);
  update public.rooms set phase = 'ended', status = 'ended', winner = 'villageois' where id = rid;
  perform pg_temp.as_player(r[4]);
  v_txt := public.get_game_recap(rid)::text;
  if (select (x->>'kills')::int from jsonb_array_elements(v_txt::jsonb->'players') x where x->>'player_id' = r[2]::text) <> 1 then
    raise exception 'ÉCHEC [récap] : meurtre du Saboteur non compté'; end if; ok := ok + 1;
  if not exists (select 1 from jsonb_array_elements(v_txt::jsonb->'players') x
                 where x->>'player_id' = r[3]::text and x->'feats' ? 'mauvais_endroit') then
    raise exception 'ÉCHEC [récap] : exploit « Mauvais endroit » absent'; end if; ok := ok + 1;
  if not exists (select 1 from jsonb_array_elements(v_txt::jsonb->'players') x
                 where x->>'player_id' = r[4]::text and x->'feats' ? 'jackpot' and (x->>'casino_net')::int = 3) then
    raise exception 'ÉCHEC [récap] : Casino ou exploit « Jackpot » faux'; end if; ok := ok + 1;
  if jsonb_array_length(v_txt::jsonb->'nights'->0->'moves') <> 5 then
    raise exception 'ÉCHEC [récap] : déplacements de la nuit incomplets'; end if; ok := ok + 1;
  perform set_config('request.jwt.claims', json_build_object('sub', gen_random_uuid(), 'role', 'authenticated')::text, true);
  begin
    perform public.get_game_recap(rid);
    raise exception 'ÉCHEC [récap] : lisible par quelqu''un hors du salon';
  exception when others then if sqlerrm not like '%not_member%' then raise; end if;
  end; ok := ok + 1;

  ---------------------------------------------------------------------------
  -- 10. Réglages revus après les parties tests (migration 0023)
  ---------------------------------------------------------------------------
  if public.game_param('kill_tie_pct') <> 60 or public.game_param('casino_win_pct') <> 60
     or public.game_param('vote_runoff_max') <> 2 then
    raise exception 'ÉCHEC [défauts 0023] : égalité %, Casino %, revotes %', public.game_param('kill_tie_pct'),
      public.game_param('casino_win_pct'), public.game_param('vote_runoff_max'); end if; ok := ok + 1;

  -- Un seul Saboteur (5 joueurs) : rumeur sur 3 joueurs uniquement, 3 jetons ; Poste de garde à 2
  r := pg_temp.mkroom('TQIA', 5); rid := r[1];
  perform pg_temp.as_player(r[2]); perform public.start_game(rid);
  if not public.rumeur_small(rid) or public.rumeur_cost(rid, 3) <> 3 or public.poste_cost(rid) <> 2 then
    raise exception 'ÉCHEC [1 Saboteur] : rumeur 3 seule %, prix %, Poste %', public.rumeur_small(rid),
      public.rumeur_cost(rid, 3), public.poste_cost(rid); end if; ok := ok + 1;
  perform pg_temp.set_role(r[2], 'villageois_simple'); perform pg_temp.set_role(r[3], 'saboteur_simple');
  for i in 4..6 loop perform pg_temp.set_role(r[i], 'villageois_simple'); end loop;
  begin
    perform public.submit_night_action(rid, 'taverne', null, jsonb_build_object('action', 'rumeur', 'targets', jsonb_build_array(r[3], r[4])));
    raise exception 'ÉCHEC [1 Saboteur] : rumeur sur 2 joueurs acceptée';
  exception when others then if sqlerrm not like '%invalid_params%' then raise; end if;
  end; ok := ok + 1;

  -- Deux Saboteurs (6 joueurs) : rumeur sur 2 ou 3 joueurs aux prix habituels ; Poste de garde à 1, payé 1
  r := pg_temp.mkroom('TQIB', 6); rid := r[1];
  perform pg_temp.as_player(r[2]); perform public.start_game(rid);
  if public.rumeur_small(rid) or public.rumeur_cost(rid, 2) <> 3 or public.rumeur_cost(rid, 3) <> 2 or public.poste_cost(rid) <> 1 then
    raise exception 'ÉCHEC [2 Saboteurs] : rumeur 3 seule %, Poste %', public.rumeur_small(rid), public.poste_cost(rid); end if; ok := ok + 1;
  perform pg_temp.set_role(r[2], 'saboteur_simple'); perform pg_temp.set_role(r[3], 'saboteur_simple');
  for i in 4..7 loop perform pg_temp.set_role(r[i], 'villageois_simple'); end loop;
  insert into public.night_actions (room_id, round, player_id, location, params) values
    (rid, 1, r[4], 'poste_garde', jsonb_build_object('target', r[2])),
    (rid, 1, r[2], 'maison', '{}'), (rid, 1, r[3], 'maison', '{}'), (rid, 1, r[5], 'maison', '{}'),
    (rid, 1, r[6], 'maison', '{}'), (rid, 1, r[7], 'maison', '{}');
  perform public.resolve_night(rid);
  select tokens into v_int from public.player_secrets where player_id = r[4];
  if v_int <> 4 then raise exception 'ÉCHEC [Poste à 2 Saboteurs] : % jeton(s) au lieu de 4 (5 - 1)', v_int; end if; ok := ok + 1;

  -- Mairie : la protection retire 1 voix contre soi (2 → 1), sans tout annuler ; puis 2 revotes au plus
  r := pg_temp.mkroom('TQIC', 5); rid := r[1];
  perform pg_temp.as_player(r[2]); perform public.start_game(rid);
  update public.rooms set phase = 'vote' where id = rid;
  insert into public.vote_tampering (room_id, round, player_id, kind, target_id) values (rid, 1, r[3], 'shield', null);
  insert into public.votes (room_id, round, voter_id, target_id) values
    (rid, 1, r[2], r[3]), (rid, 1, r[4], r[3]), (rid, 1, r[5], r[4]);
  perform public.resolve_vote(rid);
  select (tally->>r[3]::text)::int into v_int from public.vote_runoffs where room_id = rid and step = 1;
  if v_int is distinct from 1 then raise exception 'ÉCHEC [Mairie −1 voix] : % voix contre le protégé au lieu de 1', v_int; end if; ok := ok + 1;
  insert into public.votes (room_id, round, voter_id, target_id) values (rid, 1, r[2], r[3]), (rid, 1, r[5], r[4]);
  perform public.resolve_vote(rid);   -- 2e revote
  insert into public.votes (room_id, round, voter_id, target_id) values (rid, 1, r[2], r[3]), (rid, 1, r[5], r[4]);
  perform public.resolve_vote(rid);   -- plus de revote : tirage au sort
  if not exists (select 1 from public.vote_results where room_id = rid and drawn and runoffs = 2) then
    raise exception 'ÉCHEC [2 revotes] : pas de tirage au sort après 2 revotes'; end if; ok := ok + 1;

  ---------------------------------------------------------------------------
  -- 11. Fantôme Saboteur : il hante un lieu, sans voir ses alliés (migration 0024)
  --     T1 Saboteur vivant au casino face à T3 et T4 (moins nombreux : 0 %) ; T2 fantôme Saboteur, bonus 100
  ---------------------------------------------------------------------------
  r := pg_temp.mkroom('TQJA', 6, '{"ghost_haunt_bonus_pct": 100}'); rid := r[1];
  perform pg_temp.as_player(r[2]); perform public.start_game(rid);
  perform pg_temp.set_role(r[2], 'saboteur_simple'); perform pg_temp.set_role(r[3], 'saboteur_simple');
  for i in 4..7 loop perform pg_temp.set_role(r[i], 'villageois_simple'); end loop;
  update public.players set is_alive = false where id = r[3];
  perform pg_temp.as_player(r[3]);
  if jsonb_array_length(public.get_saboteur_vision(rid)->'allies') <> 0 then
    raise exception 'ÉCHEC [hantise] : le fantôme voit encore où vont ses alliés'; end if; ok := ok + 1;
  begin
    perform public.set_ghost_haunt(rid, 'maison', null);
    raise exception 'ÉCHEC [hantise] : maison acceptée';
  exception when others then if sqlerrm not like '%invalid_location%' then raise; end if;
  end; ok := ok + 1;
  perform public.set_ghost_haunt(rid, 'casino', null);
  if public.get_ghost_report(rid)->>'haunt' is distinct from 'casino' then
    raise exception 'ÉCHEC [hantise] : lieu hanté absent du rapport du fantôme'; end if; ok := ok + 1;
  insert into public.night_actions (room_id, round, player_id, location) values
    (rid, 1, r[2], 'casino'), (rid, 1, r[4], 'casino'), (rid, 1, r[5], 'casino'), (rid, 1, r[6], 'maison'), (rid, 1, r[7], 'maison');
  perform public.resolve_night(rid);
  if not exists (select 1 from public.night_deaths where room_id = rid and location = 'casino') then
    raise exception 'ÉCHEC [hantise] : pas de meurtre au casino hanté (0 %% + 100)'; end if; ok := ok + 1;

  -- Le fantôme s'est trompé de lieu : pas de bonus là où va le Saboteur
  r := pg_temp.mkroom('TQJB', 6, '{"ghost_haunt_bonus_pct": 100}'); rid := r[1];
  perform pg_temp.as_player(r[2]); perform public.start_game(rid);
  perform pg_temp.set_role(r[2], 'saboteur_simple'); perform pg_temp.set_role(r[3], 'saboteur_simple');
  for i in 4..7 loop perform pg_temp.set_role(r[i], 'villageois_simple'); end loop;
  update public.players set is_alive = false where id = r[3];
  perform pg_temp.as_player(r[3]);
  perform public.set_ghost_haunt(rid, 'taverne', null);
  insert into public.night_actions (room_id, round, player_id, location) values
    (rid, 1, r[2], 'casino'), (rid, 1, r[4], 'casino'), (rid, 1, r[5], 'casino'), (rid, 1, r[6], 'maison'), (rid, 1, r[7], 'maison');
  perform public.resolve_night(rid);
  if exists (select 1 from public.night_deaths where room_id = rid) then
    raise exception 'ÉCHEC [hantise] : bonus appliqué alors que le fantôme hantait un autre lieu'; end if; ok := ok + 1;

  raise exception 'TESTS OK : % vérifications réussies (transaction annulée)', ok;
end $tests$;

rollback;
