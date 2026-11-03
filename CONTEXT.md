# BLUFF : contexte du projet

Jeu de société mobile (Web App) à rôles cachés, 4 à 10 joueurs, en présentiel, entre amis.
Stack 100 % gratuite : React + TypeScript + Tailwind (Vite), Supabase (Postgres + Realtime + auth anonyme), Vercel.
Dépôt GitHub privé. Pas de Claude Code : le code est fourni par fichiers complets à copier dans VS Code.

## Règles de jeu validées
- Salon avec code de 4 lettres (alphabet sans voyelles) + lien direct. Pseudo + session anonyme, reconnexion possible.
- Min 4, max 10 joueurs. Impossible de rejoindre une partie lancée.
- L'hôte est un joueur normal, sans pouvoir spécial. S'il disparaît (> 25 s sans heartbeat), un autre joueur devient hôte.
- Tour : Nuit (actions secrètes avec jetons) > Jour (débat oral) > Vote > Élimination > tour suivant.
- L'élimination révèle l'équipe, pas forcément le rôle exact. Éliminés = spectateurs (actions possibles en v2).
- Jetons de départ : 2 pour les Saboteurs, 1 pour les autres.
- 11 rôles (tableur Drive "Rôles") : 5 Villageois (Mécène, Enquêteur, Garde du Corps, Juge intègre, Témoin aveugle), 4 Saboteurs (Saboteur de l'ombre, Corrupteur, Caméléon, Intercepteur), 2 Solitaires (Capitaliste, Opportuniste).
- Distribution de test (à rééquilibrer) : 4j=1S/3V ; 5j=1S/4V ; 6j=2S/3V/1Sol ; 7j=2S/3V/2Sol ; 8j=2S/4V/2Sol ; 9j=3S/4V/2Sol ; 10j=3S/5V/2Sol.
- Règle de dépendance : si l'Intercepteur est tiré, le Mécène l'est aussi.
- Solitaire : 1 à partir de 6 joueurs, 2 à partir de 7.

## Architecture
- Les rôles vivent en dur dans src/data/roles.ts. La base ne stocke que role_id (texte).
- Le client n'écrit jamais directement en base : tout passe par des fonctions SQL (RPC) security definer.
- RLS : on lit rooms/players de son salon ; player_secrets uniquement sa propre ligne.
- Présence (heartbeat) dans player_heartbeats, hors publication Realtime (évite le flot d'événements).
- Realtime : tables rooms et players. Sur tout événement, recharger la liste (les DELETE ne sont pas filtrés par RLS).
- Mode debug : option à la création du salon ; l'hôte ajoute/supprime des bots (add_bot/remove_bot). Prévu en phase 2 : "voir en tant que" + lecture des secrets des bots.
- avatar = index 0 à 9 (couleur + emoji), palette définie côté app.

## Fonctions SQL (phase 1)
create_room(pseudo, debug) | join_room(code, pseudo) | leave_room(room_id) | heartbeat(room_id) |
claim_host(room_id) | start_game(room_id) | add_bot(room_id) | remove_bot(player_id) | cleanup_inactive_rooms()
Codes d'erreur : not_authenticated, invalid_nickname, room_not_found, game_started, room_full,
nickname_taken, not_host, not_enough_players, debug_disabled.

## Écrans de la phase 1
Accueil (Créer / Rejoindre / Liste des rôles) > Création > Rejoindre > Salon d'attente > Liste des rôles > Écran "Partie lancée" (provisoire).

## Feuille de route
- Phase 0 : setup. FAIT (Vite, Tailwind, Supabase auth anonyme, Vercel).
- Phase 1 : salon et accueil + mode debug. EN COURS (SQL à exécuter, puis écrans).
- Phase 2 : distribution des rôles, révélation (maintien pour révéler).
- Phase 3 : nuit (jetons, pouvoirs).
- Phase 4 : débat, vote, élimination, victoire.

## Environnement
Mac. Variables Vercel et .env.local : VITE_SUPABASE_URL, VITE_SUPABASE_ANON_KEY (clé publique uniquement).
## État après l'étape 3b (mise à jour)
Phases 0, 1, 2, 3a, 3b faites. Prochaine étape : phase 4 (débat, vote, élimination, victoire), puis rôles couche par couche (Saboteur de l'ombre en premier).
Migrations SQL dans supabase/migrations/ (0004 = 3b, à exécuter dans Supabase > SQL Editor ; 0001 à 0003 déjà exécutées).

### Mode simple (en cours de test)
Rôles villageois_simple / saboteur_simple, 1 saboteur jusqu'à 5 joueurs puis 2. Jetons : Saboteurs 2, autres 1, +1 par joueur vivant à chaque nuit (dès la nuit 2).
Machine d'états : rooms.phase lobby > night > day > vote, round, phase_ends_at ; advance_phase appelé par les clients à l'expiration du minuteur (ou quand tous les humains ont joué).

### Lieux et effets (3b)
- Casino : mise 0 à 3 jetons, 50 % de gagner le double (résultat privé).
- Taverne : rien / cadeau secret de 1 jeton (révélé au seul receveur) / rumeur (2 ou 3 joueurs : au moins un Saboteur parmi eux ? Caméléon compté innocent). Coût rumeur : 1 jeton à 3, 2 jetons à 2.
- Poste de Garde : 2 jetons, on apprend où un joueur a passé la nuit.
- Planque (Saboteurs) : 2 jetons, ferme un lieu (casino, taverne, poste de garde) la nuit suivante ; échoue (jetons perdus) si un non-Saboteur est aussi à la Planque. Fermetures annoncées publiquement à l'aube.
- Croisements visibles : casino, taverne, planque. Discrets : poste de garde, maison.
- Coûts centralisés : SQL game_param() et miroir src/data/costs.ts (à garder alignés).
- Données : night_actions.params (choix) et night_actions.result (résultat privé) ; table closures(room_id, round, location).
- RPC : submit_night_action(room, lieu, joueur?, params) ; get_dawn_report renvoie location, present, result, closed_next.
- Erreurs ajoutées : location_closed, not_enough_tokens, invalid_params, not_saboteur.
- Front : NightPannel (options par lieu), DayPannel (rapport privé + annonce publique), hooks useNightChoices, useClosures ; useSecrets rafraîchi par "manche-phase".

## Étape 3c (phases manuelles + taverne)
- Plus de minuteurs : game_param('timers_on') = 0, un trigger garde rooms.phase_ends_at vide. Passer à 1 réactive les minuteurs (à faire en fin de projet).
- L'hôte fait avancer la partie (bouton « Résoudre la nuit (X/Y ont choisi) » puis « Passer à la nuit suivante »). advance_phase(force) réservé à l'hôte ; plus de passage automatique quand tous ont joué (c'était la cause du bug en mode debug).
- RPC night_progress(room) : compteur de joueurs ayant choisi.
- Taverne : le don n'a lieu que si le receveur est aussi à la Taverne ; sinon échec, jeton conservé, l'émetteur l'apprend à l'aube (result.don.ok = false).
- Règles de chaque lieu lisibles au moment du choix (« Lire les règles », données dans src/data/locations.ts).
- À venir : phase 4 (vote, élimination, victoire), puis Mairie (trucage : +2 voix contre un joueur OU annulation des voix contre soi ; échec si 2 joueurs, jetons perdus, croisement visible, échec annoncé aux deux ; ouvert à tous ; prix provisoire), puis carte interactive des lieux (SVG).

## Phase 4 : vote, élimination, victoire (migration 0006)
- Déroulé d'une manche (tout manuel, par l'hôte) : nuit > jour (débat) > vote > résultat > nuit suivante. Phases : lobby, night, day, vote, result, ended. rooms.winner = villageois | saboteurs.
- Vote secret (table votes, lisible par son auteur uniquement ; abstention = target null). Le plus voté est éliminé ; égalité ou aucun vote = personne. À l'élimination, seule l'équipe est révélée (vote_results.eliminated_team). Total de voix par joueur public (vote_results.tally), pas les votants.
- Sans vote au dépouillement : bots au hasard, humains s'abstiennent.
- Victoire (check_victory) : Villageois si plus aucun Saboteur vivant ; Saboteurs si Saboteurs vivants >= autres vivants. Les Solitaires comptent avec les « autres » pour l'instant.
- Éliminés : spectateurs (ni nuit ni vote), restent dans la liste, barrés avec leur équipe.
- Fin : écran avec tous les rôles (get_final_roles, disponible seulement en phase ended) ; l'hôte relance via « Retour au salon ».
- RPC : submit_vote(room, cible|null, joueur?), vote_progress(room), get_final_roles(room). Erreurs : not_vote, not_ended.
- Front : VotePannel, ResultPannel, EndPannel, hooks useVotes.ts. Tests SQL : scénarios complets dans /tmp (non versionnés).
- À venir : Mairie (trucage du vote) puis carte interactive.

## Mairie : trucage du vote (migration 0007)
- 6e lieu : la Mairie (croisement visible). Trucage à 2 jetons (game_param 'mairie_cost', provisoire), deux options : +2 voix contre un joueur choisi, ou annuler les voix reçues par soi. Agit sur le vote du jour suivant la nuit.
- Échec (jetons perdus) si au moins deux joueurs sont à la Mairie, même si un seul truque : ils se voient à l'aube et l'échec est annoncé à tous les présents.
- Un trucage réussi reste secret ; seul le total de voix (modifié) est public. Table vote_tampering (aucune lecture client).
- Ouverte à tous les camps pour l'instant. Mairie non sabotable pour l'instant.
- Prochaine étape : carte interactive des lieux (SVG), avec les 6 lieux et les règles lisibles.

## Carte interactive des lieux (front uniquement)
- src/components/VillageMap.tsx : village en SVG, un bâtiment cliquable par lieu (6 lieux), sélection animée, lieux fermés barrés « FERMÉ ». Un bouton « i » par bâtiment ouvre les règles du lieu sans faire de choix ; le panneau propose « Aller à : … ».
- NightPannel : carte + fiche du lieu choisi + options (casino, taverne, poste de garde, planque, mairie). Positions et couleurs des bâtiments dans SPOTS (VillageMap.tsx).
- Un nouveau lieu = une entrée dans locations.ts + une entrée dans SPOTS + éventuellement un bloc d'options dans NightPannel.

## Étape 1 des meurtres (migration 0008_meurtres.sql)
- Règle de mort par lieu et par nuit (hors maison) : Saboteurs > Villageois présents = un Villageois meurt à coup sûr ; égalité = `kill_tie_pct` % (50) ; sinon personne. Max 1 mort par lieu, victime tirée au hasard parmi les Villageois présents, meurtre gratuit.
- Annonce à l'aube : nom du mort public, lieu secret (`game_param('death_reveals_location')` = 0 ; mettre 1 pour l'annoncer).
- Aveuglement : les Villageois survivants d'un lieu où l'on a tué n'ont ni liste des présents ni info de nombre, juste `cry`. Les Saboteurs ne sont pas aveuglés. La victime voit `killed`.
- Maison protégée (jamais de mort) et impossible 2 nuits de suite (`maison_twice`) ; les bots respectent la règle.
- Victoire des Saboteurs vérifiée dès l'aube. Trucages de la Mairie des morts ignorés au dépouillement.
- Morts (tués ou éliminés) = fantômes v1 : ne jouent ni ne votent, regardent. Table `night_deaths` (aucun accès client), lue via `get_dawn_report` (`deaths`, `cry`, `killed`).
- Front : api.ts (DawnReport + message), DayPannel (annonce, cri, tué), locations.ts (règles maison), Game.tsx (libellés).
- À venir : étape 2 fantômes (observation + indice), étape 3 cimetière.

## Réglages de la partie + revote (migration 0009_reglages.sql)
- Table `room_settings(room_id, vals jsonb)` : réglages par salon, modifiés par l'hôte dans le salon avant le lancement (RPC `update_room_settings`, `reset_room_settings`, lecture `get_room_settings`). `room_param(room, clé)` = valeur du salon sinon `game_param(clé)` (défauts). Bornes dans `setting_bounds()` (SQL) et `src/data/settings.ts` (front) : à garder alignés.
- Réglages : nombre de saboteurs (0 = auto), jetons de départ et gains par nuit par camp, % de meurtre (saboteurs plus nombreux / égalité / moins nombreux), annonce du lieu du meurtre, coûts des lieux, casino (mise max, % de gain), revotes max.
- Les coûts affichés dans le jeu viennent des réglages : `useRoomSettings` → `applySettingsToCosts` (`src/data/costs.ts`). UI : `SettingsPanel` dans `Lobby.tsx` (hôte modifie, autres lisent). Réglages conservés au retour au salon.
- Égalité au vote : nouveau vote entre les ex æquo (`rooms.vote_step`, `vote_candidates`, historique `vote_runoffs`), jusqu'à `vote_runoff_max` départages, puis tirage au sort ; 0 = égalité = personne. Trucages Mairie comptés au premier décompte seulement. `vote_results.runoffs/drawn`.

## Étape 2 des fantômes (migration 0010_fantomes.sql)
- Fantôme = joueur mort (tué ou éliminé). Chaque nuit il observe 1 vivant (`submit_ghost_watch`, gratuit) et apprend à l'aube où il a passé la nuit (`ghost_watch.location`, rempli par `resolve_night`). Il désigne un suspect modifiable à tout moment (`set_ghost_hint`, table `ghost_hints`) : il servira d'indice au Cimetière (étape 3) ; un fantôme saboteur peut mentir.
- Lecture uniquement via `get_ghost_report(room, player)` : `{ghost, watches[{round,target_id,location}], suspect}`. Fantômes-bots : observation et suspect au hasard.
- Front : `GhostPannel.tsx` (mode nuit = choix de l'observé ; mode info = historique + suspect, affiché aussi le jour/vote/résultat), `useGhostReport.ts`, appels dans `api.ts`, intégration dans `Game.tsx`.
- À venir : étape 3 cimetière (tombes, 7e lieu, indice).

## Étape 3 : le Cimetière (migration 0011_cimetiere.sql)
- 7e lieu `cimetiere` (croisement visible, règle de mort comme les autres lieux). Chaque fantôme choisit sa tombe (`set_ghost_tomb`, colonne `ghost_hints.tomb`, 1..`tomb_count`) ; tirée au hasard à la résolution de la nuit tant qu'il n'a pas choisi.
- Un vivant peut y choisir une tombe (`params.tomb`, coût `cemetery_cost` = 1 jeton ; sans tombe = gratuit mais rien appris). Résultat `result.cimetiere = {tomb, ok, spirits:[{ghost_id, suspect_id}]}` : on apprend le nom du fantôme et son suspect actuel (peut mentir). Plusieurs fantômes sur la même tombe = plusieurs indices.
- Nouveaux réglages (salon) : `cemetery_cost` (1), `tomb_count` (3, de 2 à 6).
- Front : `locations.ts` (Cimetière), `VillageMap.tsx` (7 bâtiments, viewBox 360x540), `NightPannel.tsx` (choix de tombe), `DayPannel.tsx` (indices à l'aube), `GhostPannel.tsx` (choix de la tombe), `costs.ts`/`settings.ts`.
- Reste à faire : vérifier la carte à 7 bâtiments sur téléphone ; rôles spéciaux ; équilibrage ; minuteurs (`timers_on`).

## Équilibrage après les parties à 5 (migration 0012_equilibrage.sql)
- Jetons de départ : Villageois 1, Saboteur 3 (réglables). Mairie : un trucage réussi ajoute `mairie_boost` = 1 voix (au lieu de 2).
- Petite partie (≤ `rumeur_small_max_players` = 5 joueurs) : la rumeur cible exactement 3 joueurs et coûte `rumeur_small_cost` = 3 jetons (`rumeur_small()`, `rumeur_cost()` en SQL ; `isSmallGame`, `rumeurCost(n, totalPlayers)` en front).
- Planque : sabotage ANONYME et IMMÉDIAT (même nuit), plus aucune fermeture ni annonce publique (la table `closures` n'est plus alimentée). Cibles : casino (toutes les mises perdent), taverne (rumeurs inversées), poste de garde (lieu annoncé faux, tiré au hasard), mairie (le tricheur reçoit 1 voix contre lui : `vote_tampering.kind = 'backfire'`). Échec (jetons perdus) si un non-saboteur est à la Planque. Pré-passe dans `resolve_night`.
- Mort subite (`sudden_death_on` = 1) : `update_victory(room, après_vote)` remplace `check_victory` : Saboteurs > autres = victoire immédiate ; égalité = la partie continue (`rooms.sudden_death`), et si l'égalité survit à un vote, les Saboteurs gagnent. `sudden_death_on` = 0 : ancienne règle (égalité = victoire). Bannière dans `Game.tsx`.

## Ajustements (migration 0013_ajustements.sql)
- 1 Saboteur contre 1 seul autre joueur vivant : victoire automatique des Saboteurs (dans `update_victory`), même avec la mort subite.
- Le Cimetière n'ouvre qu'à partir du premier mort (`location_closed` sinon ; bots exclus ; fermé sur la carte côté front tant que tous sont vivants).
- Le choix de tombe d'un fantôme est définitif (`tomb_locked`), y compris une tombe tirée au hasard à la résolution de la nuit.
