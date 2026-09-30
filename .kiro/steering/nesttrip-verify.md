---
inclusion: auto
name: nesttrip-verify
description: Gate de vérification obligatoire avant d'annoncer une tâche terminée dans NestTrip — lint, typecheck, tests unitaires, tests e2e ciblés, et limites de la vérification visuelle. À activer systématiquement en fin de tâche de code sur ce repo, avant de dire "c'est fait" / "terminé".
---

# Vérifier avant de dire "terminé" (NestTrip)

La procédure exacte (ordre des commandes `ng lint` → `tsc --noEmit` → `ng test` → e2e ciblés,
et les règles sur la vérification visuelle réelle) est dans le skill projet ci-dessous. Ne jamais
annoncer une tâche terminée sans être passé par cette gate.

#[[file:.claude/skills/nesttrip-verify/SKILL.md]]
