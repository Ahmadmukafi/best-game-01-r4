// main.ts — hands ECHODEEP in.
// Copies game/ and screenshots/ from this repository into the output
// directory (MAKEFUN_OUTPUT_DIR, or /output) and writes dossier.json there
// with buildDossier from vendor/makefun-game.ts.
// It never deletes the output directory itself — that is the grader's
// mount — it only replaces the game/ and screenshots/ trees inside it.
// Node 22 standard library only, no network, deterministic: two runs over
// the same repository write byte-identical files.

import { cpSync, existsSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildDossier } from './vendor/makefun-game.ts';

const repoRoot = dirname(fileURLToPath(import.meta.url));
const outDir = process.env.MAKEFUN_OUTPUT_DIR || '/output';

function main(): void {
  mkdirSync(outDir, { recursive: true });
  // Replace only the two trees this program owns inside the output dir.
  for (const sub of ['game', 'screenshots']) {
    const target = join(outDir, sub);
    if (existsSync(target)) rmSync(target, { recursive: true, force: true });
  }
  cpSync(join(repoRoot, 'game'), join(outDir, 'game'), { recursive: true });
  cpSync(join(repoRoot, 'screenshots'), join(outDir, 'screenshots'), { recursive: true });
  const dossier = buildDossier(outDir, {
    text_max_bytes: 163840,
    screenshots: { max: 4, max_bytes: 262144 },
    game_max_files: 993,
    game_max_bytes: 50331648,
  });
  writeFileSync(join(outDir, 'dossier.json'), dossier);
}

main();
