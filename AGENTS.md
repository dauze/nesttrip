<!-- bmad:context -->
<!-- Verified 2026-10-30 against 5b38dfe. Managed by bmad-project-context; recheck every claim before refresh. -->

## NestTrip

- Pour les priorites, lire le plan d'execution de `ROADMAP.md`; pour toute modification de roadmap, suivre `.claude/skills/nesttrip-roadmap/SKILL.md`.

## Policy

- Ne pas committer de valeurs de deploiement dans les fichiers suivis `src/environments/environment*.ts` sans revue explicite; `scripts/set-env.js` ecrase `environment.prod.ts`.

## Where things are

- Invariants metier et Firebase : `CLAUDE.md`.
- Verification avant cloture : `.claude/skills/nesttrip-verify/SKILL.md`.

## Running and verifying

- Utiliser Node 24.18.0 (`.nvmrc`, `.node-version`) et npm 11.6.1 (`package.json`).
- A la racine, utiliser `npm install`, pas `npm ci`; le lockfile racine est ignore, celui de `functions/` est suivi.
- `npm run build` ne lance pas `scripts/set-env.js`; verifier la configuration de deploiement avant un build de production.

<!-- /bmad:context -->