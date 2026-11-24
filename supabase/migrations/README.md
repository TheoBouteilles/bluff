Historique des migrations SQL de Bluff (à exécuter dans l'ordre dans Supabase > SQL Editor).
0001 à 0003 ont déjà été exécutées (phases 1, 2, 3a). 0004 : effets des lieux (3b). 0005 : phases manuelles + règle taverne (3c).
0006 : phase 4 (vote, élimination, victoire).
0007 : la Mairie (trucage du vote).
0008 à 0016 : voir les fichiers (meurtres, réglages, fantômes, cimetière, équilibrage, ajustements, validation, planque/fantômes, vision directe).
0017 : statistiques et trophées (trigger de fin de partie, get_my_stats, get_new_trophies). Déjà appliquée.
0018 : Solitaires (Capitaliste, Opportuniste), distribution sans les rôles spéciaux. Déjà appliquée.
0019 : données d'équilibrage (durée, fin à l'aube ou au vote, Solitaires, réglages) et get_balance_stats. Déjà appliquée.
0020 : hygiène des droits, remove_bot limité au salon d'attente, hôte remplacé après 60 s. Déjà appliquée. Tests : supabase/tests/scenarios.sql.
0021 : comptes optionnels (profils, pseudo, avatar personnalisé, préférences, fusion invité → compte). Déjà appliquée.
0022 : récap de fin de partie visible par tous (get_game_recap : exploits de chacun, bilan, nuit par nuit). Déjà appliquée.
0023 : réglages revus après les parties tests (égalité 60 %, Casino 60 %, 2 revotes, rumeur sur 3 joueurs à 3 jetons avec un seul Saboteur, Poste de garde 2 / 1 jeton selon les Saboteurs, Mairie « −1 voix contre soi »). Déjà appliquée.
0024 : le fantôme Saboteur hante un lieu (set_ghost_haunt(salon, lieu)) sans voir ses alliés ; vision réservée aux Saboteurs vivants. Déjà appliquée.
