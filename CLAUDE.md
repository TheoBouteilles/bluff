# BLUFF : contexte du projet

Jeu de société mobile (Web App) à rôles cachés, 4 à 10 joueurs, en présentiel, entre amis.
Stack 100 % gratuite : React + TypeScript + Tailwind (Vite), Supabase (Postgres + Realtime + auth anonyme), Vercel.
Dépôt GitHub privé. Le code est édité directement dans le dépôt avec Claude Code (app Claude, onglet Code) : toujours faire `git pull` avant de commencer, des changements peuvent avoir été poussés depuis Claude. Les migrations SQL sont à exécuter dans Supabase > SQL Editor (ou via le connecteur Supabase si demandé).

## Règles de jeu validées
- Salon avec code de 4 lettres (alphabet sans voyelles) + lien direct. Pseudo + session anonyme, reconnexion possible.
- Min 4, max 10 joueurs. Impossible de rejoindre une partie lancée.
- L'hôte est un joueur normal, sans pouvoir spécial. S'il disparaît (> 25 s sans heartbeat), un autre joueur devient hôte.
- Tour : Nuit (actions secrètes avec jetons) > Jour (débat oral) > Vote > Élimination > tour suivant.
- L'élimination révèle l'équipe, pas forcément le rôle exact. Éliminés = spectateurs (actions possibles en v2).
- Rôles : Villageois et Saboteurs (rôles « simples » sans pouvoir), plus 2 Solitaires en option (Capitaliste, Opportuniste), voir « Solitaires (0018) ». Les 9 autres rôles spéciaux du tableur (Mécène, Enquêteur, Caméléon…) sont abandonnés : trop de complexité.

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

## Validation, minuteurs, règles (0014)
- **Valider / Retour** : nuit (NightPannel, brouillon local puis `submit_night_action` à la validation), vote (VotePannel) ; `cancel_night_action`, `cancel_vote`, `cancel_ghost_watch` (RPC dispo, fantômes non bloquants, UI inchangée).
- `advance_phase(force)` : refuse (`players_not_ready`) si un joueur humain vivant n'a pas validé (nuit : ligne night_actions ; vote : ligne votes, abstention comprise). Bots exclus. Minuteur écoulé : passe sans exiger la validation. `night_progress`/`vote_progress` ne comptent que les humains vivants. Bouton hôte désactivé tant que `played < total`.
- **Minuteurs par salon** : réglages `timers_on` (défaut 0), `night_seconds` 120, `day_seconds` 300, `vote_seconds` 90 ; `room_phase_seconds(room, phase)` remplace `phase_seconds`; trigger `rooms_apply_timer_setting` utilise `room_param`.
- **Jetons de départ Saboteur** : `tokens_start_saboteur_solo` 3 (1 saboteur), `tokens_start_saboteur` 2 (par saboteur à plusieurs).
- **Rumeurs +1** : rumeur3 2, rumeur2 3, petite partie 4.
- **Onglet Règles** : `RulesPanel` (valeurs du salon injectées) = 3e onglet en partie + page `/regles?salon=CODE` (lien dans le salon).

## Carte illustrée
- `VillageMap` utilise `public/village.jpg` (864x1222) ; zones cliquables en polygones (SPOTS), lieu choisi = halo doré pulsé + reste assombri, lieu fermé = voile noir + croix rouge. Bouton « i » par lieu conservé.

## Corrections et options (0015)
- **Bug Mairie** : cause = cible par défaut du boost (1er joueur de la liste). Front : plus de cible par défaut pour le boost Mairie et le cadeau Taverne (Valider bloqué sans cible). Les trucages restent comptés au 1er décompte seulement (pas aux revotes), choix de Théo.
- `night_kill(room, round, loc)` : meurtre d'un lieu (vivants seulement, max 1 mort, hantise incluse).
- **Planque** (`planque_kill_first`, défaut 1) : meurtre de la Planque d'abord, sabotage réussi s'il n'y reste aucun non-saboteur vivant. Même lieu visé par 2 saboteurs : seul le premier paie (`shared`).
- **Casino saboté** (`casino_sabotage_steal`, 1) : le saboteur du casino reçoit ceil(somme des mises / 2) (`casino_steal` dans son résultat).
- **Cimetière nominatif** (`cemetery_named`, 1) : param `{ghost}` (mort non saboteur) au lieu de `{tomb}` ; GhostPanel masque la tombe (et le suspect pour un fantôme saboteur).
- **Hantise** (`ghost_haunt_on` 1, `ghost_haunt_bonus_pct` 25) : +25 points de chance de meurtre par fantôme saboteur qui hante un saboteur vivant présent dans le lieu (cumulable, plafond 100). Table `ghost_haunts`, RPC `set_ghost_haunt`, get_ghost_report renvoie `haunt`. Bots fantômes saboteurs hantent au hasard.
- **Vision des Saboteurs** (`saboteur_vision`, 1) : RPC `get_saboteur_vision(room, player)` → lieux validés des saboteurs vivants alliés + hantises de la nuit ; hook `useSaboteurVision` (poll 3 s) ; bandeau « Tes alliés » + pastille 💀 sur la carte, lieu de l'allié dans le panneau Hantise.

## Vision directe (0016)
- `night_drafts` + RPC `set_night_draft(room, location, player)` : le lieu touché sur la carte par un Saboteur est partagé avec ses alliés avant validation ; `get_saboteur_vision` renvoie `location` (validé sinon brouillon) + `validated`. Poll 2 s. Carte : 💀 plein = validé, pâle/pointillé = indécis, ×N si plusieurs alliés.
- Fantôme Saboteur (hantise active) : plus de section « observer », texte adapté (il aide un allié au lieu d'espionner).

## Refonte pixel art (étape 1 : avatars, cartes de rôle, menu, interface)
- **Style** : inspiré de wonderhop.io. Palette sépia/nuit dans `src/index.css` (@theme : ink, night/night-2/night-3, paper, sand, gold, blood, sea, moss, mist). Polices : Jersey 10 (titres et nombres, `font-display` = « Bluff Display ») et VT323 (boutons, étiquettes, carte, `font-pixel` = « Bluff Pixel »), servies depuis `public/fonts/` avec `size-adjust` dans `index.css` (choisies pour distinguer 2/Z, B/8, 0/O et bien rendre les accents ; Silkscreen, Pixelify Sans et Press Start 2P écartées) ; IBM Plex Mono (texte, `font-sans`, @fontsource). Utilitaires : `px-frame` (cadre encre + liseré + ombre dure), `px-frame-paper`, `px-inset`, `px-press`, `px-ticket` (encoches), `px-img` (pixelated), `px-scan`. Animations : bob, pop, rise, float, blink-slow, shake, shine (respect de prefers-reduced-motion).
- **Composants** `src/components/ui.tsx` : Button (primary/secondary/danger/ghost), TitleBar, Tabs, Label, Note, TokenBadge ; `BackLink.tsx` ; `Px.tsx` : `<Px name>` (icônes) et `<Avatar index kind="face"|"body" scale ring>` (bonhomme = bande 2 frames animée par `animate-bob`).
- **Sprites** : générés par `python3 tools/px/build.py` (grilles de texte dans `tools/px/avatars.py` et `icons.py`, palette dans `px.py`) → `public/px/avatars/<id>_face.png` (16x16), `<id>_body.png` (32x24, 2 frames), `public/px/icons/*.png` (coin, crown, ghost, moon, sun, skull, check, lock, team_*). `tools/px/sheet.png` = planche de contrôle. `src/data/avatars.ts` porte `id`/`name` (emoji conservé en secours).
- **Écrans** : Home, CreateRoom, JoinRoom, Lobby, RolesList, RoleCard (ticket perforé par camp), HoldToReveal, en-tête/onglets/liste de joueurs de Game ; anciens panneaux migrés vers les nouvelles classes (emoji → `<Avatar>`).
- **Vitrine** : route `/demo` (dev seulement, `npm run dev` puis http://localhost:5173/demo) pour vérifier les composants avec des données factices sans Supabase. Capture mobile : Playwright 390 px.
- À faire (étape 2) : carte du village jour/nuit en pixel art, intérieurs des lieux, écrans Aube/Résultat/Fin plus animés.

## Refonte pixel art (étape 2 : logos, carte du village)
- `HoldToReveal` : bouton au-dessus de la carte (plus de décalage sous la souris) + `setPointerCapture` ; relâchement n'importe où (window pointerup) masque.
- Logos de camp : blasons 32x32 générés par `tools/px/logos.py` (`team_<camp>.png`) + versions 12x12 (`team_<camp>_s.png`) pour les listes.
- Carte du village : `tools/px/village.py` dessine la carte 144x204 (vue 3/4, 7 lieux aux emplacements de l'ancienne carte, fontaine, lampadaires, arbres). Une seule grille de clés, deux palettes : jour (`DAY`) et nuit (`NIGHT` = teinte bleutée + fenêtres/flammes/sol des lampadaires allumés, feux follets au cimetière). 2 images par mode (flammes/eau inversées) → `public/px/village/{day,night}_{0,1}.png`, alternées en CSS (`.village-flicker`). Zones cliquables générées dans `src/data/villageSpots.ts` (repère 864x1224 ; poly, c centre, i bouton règles, l étiquette).
- `VillageMap` : props `mode` ('day'|'night'), `readonly`, sélection = lieu découpé dans un voile sombre + cadre or en pointillés animés + flèche ▼ ; étiquettes en plaques crème. La carte de jour (lecture seule, lieu de la nuit surligné) est affichée dans le rapport d'aube (DayPannel).
- Pour modifier la carte : éditer `tools/px/village.py`, `python3 tools/px/build.py` ; aperçus `tools/px/village_day.png` / `village_night.png` (x4).

## Carte du village v2 (détaillée + vivante)
- Remplace la carte v1 (supprimée). Générateur : `python3 tools/px/build2.py` (aperçus `tools/px/v2_day.png`, `v2_night.png`).
- `tools/px/pal2.py` : rampes de couleurs par matériau (grass, dirt, cobble, stone, sand, plaster, wood, slate, tile, thatch, purple, gold, red, blue, glass, water, leaf, interior…), `K(rampe, niveau)` → caractère ; palette nuit calculée (clair de lune) sauf teintes « allumées » (glass, flame, gold, interior) ; caractères `LAMP` = sol éclairé par les lanternes la nuit.
- `tools/px/village2.py` : décor fixe 216x306 (x4 → 864x1224), bâtiments médiévaux fantasy : Mairie (beffroi à flèche d'ardoise, cloche, horloge, ailes en grès, bannières), Tripot (= casino : colombages pourpres, étage en encorbellement, enseigne aux dés, coffre d'or), Taverne (chaume, colombages, enseigne chope, tonneaux, porte éclairée), Tour de guet (hourds en bois, toit conique, meurtrières, poste de garde, râtelier, brasero), Planque (cabane de travers moussue, fenêtre condamnée, avis de recherche, caisses, trappe), Cimetière (crypte gothique, ange, tombes et croix, arbre mort, muret et grille), Maison (chaume, lucarne ronde, porte ronde verte, volets, potager, barrière, puits). Place pavée, fontaine, lanternes, étal du marché, panneau d'affichage, pins. Génère `public/px/village2/base_{day,night}.png` et `src/data/villageSpots.ts`.
- `tools/px/village_life.py` : sprites en bandes (`public/px/village2/sprites/<nom>_<day|night>.png`) : fontaine qui coule (4 img), drapeaux bleu/rouge, feuillage au vent (arbres ronds = feuillage animé seulement, troncs dans le décor), touffes d'herbe, flammes, poules, chat, corbeau, oiseaux, papillons, chauves-souris, rat, feux follets ; manifeste `src/data/villageLife.ts` (positions, durées, modes jour/nuit, déplacements).
- `VillageLife.tsx` : rend les sprites (`.vl-strip` steps(n)), déplacements CSS (`vl-walk` + `vl-flip`, `vl-fly`, `vl-flutter`, `vl-bat`, `vl-wisp`), fumées de cheminée, lucioles et halos de lanternes (nuit), feuilles au vent et ombres de nuages (jour). `VillageMap` : base + VillageLife + voile sombre masqué autour du lieu choisi.

## Correctifs carte et nuit
- Plus de bulles « i » sur la carte. Dans `NightPannel`, quand un lieu est choisi : menu déroulant `<details>` « Règles : <lieu> » (fermé par défaut, refermé à chaque changement de lieu) sous les actions, juste avant Valider.
- Poule et rat (`vl-walk`) : le retournement utilisait transform-box: fill-box, dont le cadre englobait toute la bande d'images → saut de position. Désormais `translateX(var(--fw)) scaleX(-1)` avec origine 0,0.

## Fiche lieu et finitions (13 nov.)
- `src/components/LocationCard.tsx` : fiche lieu façon ticket papier (comme RoleCard) affichée sous la carte quand un lieu est choisi. Bandeau « Fiche lieu » + tag visible/discret, vignette du bâtiment découpée dans `base_<mode>.png` (repère `VILLAGE_SPOTS`), nom, description, « Actions possibles » (options du lieu, styles papier dans NightPannel), règles en menu déroulant fermé en bas de fiche, tampon « Validé » une fois le choix verrouillé.
- Coche pixel art (`<Px name="check">`) devant « Choix validé » et « Vote validé ».
- `SettingsPanel` : réglages fermés par défaut (aussi pour l’hôte).
- Page Règles : barre de titre collée en haut (`sticky`) avec le bouton retour.
- Touffes d’herbe animées (`tools/px/village_life.py`) : placées automatiquement sur de l’herbe dégagée de la carte de base (jamais sur bâtiment, chemin, arbre ou couronne) et dessinées avant les couronnes d’arbres.

## Statistiques et trophées (migration 0017_stats.sql, appliquée)
- Faits marquants figés à la fin de partie par le trigger `rooms_record_stats` (passage de `rooms.phase` à `ended`) → `record_game_stats(room)`, avant que `reset_room` n'efface les données. Une erreur dans les stats est attrapée (warning) et ne bloque jamais la fin de partie.
- Tables : `game_history` (une ligne par partie, sans clé étrangère vers rooms), `player_game_stats` (une ligne par joueur humain et par partie, clé `user_id` = auth.uid()), `player_trophies` (user_id, trophy_id, game_id). RLS sans policy : lecture uniquement via RPC.
- Parties en mode debug et bots jamais comptés. Après un départage, seul le dernier tour de vote de la manche compte pour le « flair ».
- RPC : `get_my_stats()` (agrégats, séries, lieux, trophées, 10 dernières parties), `get_new_trophies(room)` (trophées débloqués à la dernière partie du salon). Réservées au rôle authenticated.
- Front : `src/pages/Stats.tsx` (route `/stats`, lien sur l'accueil), `src/data/trophies.ts` (ids alignés sur `record_game_stats`), `EndPannel.tsx` (« Trophées débloqués »).
- Identité = session anonyme Supabase, donc liée à l'appareil. Prévu : création de compte en convertissant la session anonyme (même user_id, stats conservées).

## Son : musique et bruitages (front uniquement)
- `src/lib/audio.ts` : tout est synthétisé avec la Web Audio API (chiptune), aucun fichier audio. Bruitages `playSfx(nom)`, musique `setMusic(thème)` (petit séquenceur en croches, une boucle par phase : lobby, night, day, vote ; jingles de fin win_villageois / win_saboteurs joués une fois ; grillons et hibou la nuit, oiseaux le jour).
- Réglages par appareil dans localStorage `bluff:audio` (musique coupée par défaut : à table, un seul téléphone devrait la jouer ; bruitages et vibrations activés). Panneau `SoundOptions.tsx` (bouton ♪ dans la partie et le salon, lien « Son » sur l'accueil). Hooks `useAudioSettings`, `useMusic` (`src/hooks/useAudio.ts`).
- `main.tsx` : chaque appui débloque l'audio (règle des navigateurs mobiles) et joue un « tic » sur les boutons.
- Règle : aucun son ne doit trahir une action secrète. Toutes les actions de nuit, votes et choix de fantôme jouent le même « validate » (annulation : « cancel », erreur : « error »).
- Événements publics dans `Game.tsx`, seulement lors d'un changement vécu en direct (pas au rechargement) : tombée de la nuit (cloche + loup), aube (coq), mort annoncée (glas), ouverture du vote (tambour), départage (gong), résultat (élimination ou personne). Révélation du rôle (`HoldToReveal`) et trophées en fin de partie (`EndPannel`) ont aussi leur son.

## Correctif revote
- Au départage, le serveur efface les votes de la manche : `useVoteChoices` recharge à chaque `vote_step` et le `VotePanel` est remonté (clé `tId-vote_step`), sans choix présélectionné.

## Solitaires (migration 0018_solitaires.sql)
- Rôles abandonnés : seuls `villageois_simple`, `saboteur_simple`, `capitaliste`, `opportuniste` existent (`src/data/roles.ts` : `SIMPLE_ROLES`, `SOLO_ROLES`, `ROLES` = menu Rôles). `start_game` n'a plus de branche « roles ».
- Distribution (réglages du salon) : `solitaires_on` (1), 1 Solitaire dès `solitaire1_min_players` (7), 2 dès `solitaire2_min_players` (8), tirés parmi les deux ; ils remplacent des Villageois (toujours au moins 1 Villageois).
- Solitaires = « non-Saboteurs » : tuables, innocents aux rumeurs, comptent face aux Saboteurs pour la victoire du camp, jetons et revenus des Villageois. Leur victoire est personnelle (`player_secrets.solo_won`), en plus du camp gagnant (`rooms.winner` inchangé).
- Capitaliste : trigger `player_secrets_capitaliste` (avant mise à jour des jetons) → `solo_won` dès `tokens >= capitaliste_goal` (10), acquis définitivement.
- Opportuniste : pari secret `player_secrets.side` via RPC `set_opportunist_side(room, side, player)` (nuit, vivant ; 1er choix gratuit, changement = `opportuniste_switch_cost` 2). Bot : pari au hasard au lancement. Trigger `rooms_end_solitaires` à la fin (avant `rooms_record_stats`, ordre alphabétique) : `solo_won` = vivant et `side = winner`.
- `get_final_roles` renvoie `solo_won` et `side` ; stats : victoire d'un Solitaire = `solo_won`, `get_my_stats` renvoie `solitaires_games/wins`.
- Front : `SolitairePanel.tsx` (objectif du Capitaliste avec jauge, pari de l'Opportuniste) en haut de l'onglet d'action ; `EndPannel` (victoire personnelle), `RulesPanel` (section Solitaires), `RolesList`.
- Réglages : `SettingsPanel` en sections repliables (Camps et Solitaires, Jetons, Meurtres, Lieux et prix, Fantômes et Saboteurs, Vote et victoire, Minuteurs) avec compteur de valeurs modifiées ; `showIf` masque un réglage sans effet (durées sans minuteurs, seuils sans Solitaires, tombes avec cimetière nominatif…).
