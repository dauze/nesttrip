---
inclusion: always
---

# NestTrip — contexte projet

Les instructions projet complètes (stack, architecture, patterns store/repository/mapper,
règles anti-flicker, ce qu'il ne faut pas faire) vivent dans `CLAUDE.md` à la racine.
Elles sont la source de vérité unique — ne pas les dupliquer ici.

#[[file:CLAUDE.md]]

## Roadmap

- `ROADMAP.md` (racine) : ce qui reste à faire. Seul fichier à lire pour choisir un item.
- `ROADMAP_already done.md` (racine) : historique de ce qui est clos. Ne le lire que si un
  contexte sur du travail déjà fait est explicitement nécessaire.

## Specs de features

Des specs markdown de features existantes vivent dans `src/specs/` (`devise.md`,
`Parcours-new-user.md`, `process-creation-trip-ia.md`, `Reservation.md`). Les consulter
avant de toucher à une de ces features.
