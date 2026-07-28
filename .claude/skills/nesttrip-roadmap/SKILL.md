---
name: nesttrip-roadmap
description: Reprendre, détailler et clore un item de ROADMAP.md dans le projet NestTrip — respecte l'ordre d'exécution en cours, ne devine jamais un choix UX ambigu (pose la question), et documente la décision/complétion au bon endroit. À utiliser dès qu'on avance sur la roadmap NestTrip, qu'on "reprend"/"continue"/"détaille" un item, ou qu'on s'apprête à le marquer comme fait.
---

# Itérer sur ROADMAP.md (NestTrip)

## 1. Choisir l'item

- Lire d'abord la section en tête de `ROADMAP.md` ("Plan d'exécution en cours" si elle existe) : elle fixe l'ordre voulu par l'utilisateur. Le respecter — ne pas piocher un autre item du "🔧 À faire" par confort technique.
- Ne **jamais** démarrer un item marqué **non prioritaire** ou **en pause** sans demander explicitement confirmation à l'utilisateur d'abord (ces items sont volontairement mis de côté : montée de version majeure, refacto transverse, décision d'architecture non tranchée, secret nécessitant une action manuelle de l'utilisateur, etc.).
- Si aucun "Plan d'exécution en cours" n'est présent, demander à l'utilisateur quel item traiter plutôt que de choisir seul.

## 2. Détailler — ne jamais deviner l'UX

Beaucoup d'items sont écrits en une ligne volontairement ouverte. Avant de coder :

- Identifier s'il y a plusieurs façons UX raisonnables de résoudre l'item (layout, timing d'animation, comportement au clavier/tactile, ce qui se passe en cas d'erreur, etc.).
- Si oui : poser la question via `AskUserQuestion` avec des options concrètes (pas une question ouverte). C'est le même mécanisme que les décisions déjà tracées en tête de `ROADMAP.md` ("Décisions prises avec l'utilisateur le 2026-07-28").
- Rappel de la philosophie produit (donnée explicitement par l'utilisateur) : **simplicité** — l'app doit permettre de tout faire simplement, sans multiplier les réglages/toggles. Une option qui résout un problème en ajoutant un paramètre explicite à l'utilisateur est probablement la mauvaise réponse ; chercher un comportement par défaut intuitif à la place.
- Une fois la décision prise, la consigner dans `ROADMAP.md` (section plan en tête, même style que l'existant) avant d'implémenter — pas seulement dans la conversation.

## 3. Implémenter

- Respecter strictement les patterns de `CLAUDE.md` (repository/mapper/DebounceWriter, store normalisé `TripStore`, anti-flicker `_pendingActivityIds`/`_pendingReservationIds`, `signal.update()` jamais de mutation en place).
- Pour tout ce qui touche `TripStore`/`TripFacade` ou plus de 2-3 fichiers, passer par une phase de planification (EnterPlanMode) avant d'éditer.

## 4. Vérifier

Toujours passer par la skill `nesttrip-verify` avant d'annoncer l'item terminé. Ne jamais dire "vérifié visuellement" pour un changement UI sans confirmation réelle de l'utilisateur (Google Maps/Fonts sont bloqués dans le bac à sable d'exécution — voir `nesttrip-verify`).

## 5. Clore proprement

- Déplacer la ligne de "🔧 À faire" vers "✅ Déjà fait", écrite en une phrase concise dans le même registre/voix que les entrées existantes (français direct, technique, sans emoji superflu — voir le bas du fichier pour le ton).
- Supprimer toute trace de l'item ailleurs (section "Plan d'exécution en cours", décisions provisoires) : un item terminé ne doit être décrit qu'à un seul endroit, dans "✅ Déjà fait".
- Si l'item n'est que partiellement traité, le laisser dans "🔧 À faire" avec une note précise de ce qui reste (ne pas le marquer fait par optimisme — cf. le cas du pull-to-refresh, marqué "fait, non confirmé" puis retombé cassé).
