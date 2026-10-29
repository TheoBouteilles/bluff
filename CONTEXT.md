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
