// Trusted supervisor entry point; never called by the local implementation worker.
import { readFile } from 'node:fs/promises';
import { database } from '../orchestrator/database.mjs';
import { completeVerifiedTask } from '../orchestrator/analytics.mjs';
const index = process.argv.indexOf('--task'), id = process.argv[index + 1];
if (index < 0 || !/^[A-Za-z0-9_-]{1,200}$/.test(id || '') || !process.argv.includes('--confirm-verified'))
  throw Error('After completing review and required checks, use --task ID --confirm-verified. This records completion now, never a historic estimate.');
const cfg = JSON.parse(await readFile(new URL('../worker.config.json', import.meta.url), 'utf8'));
const recorded = await completeVerifiedTask(database(cfg.firebaseProjectId, cfg.credentialMode), id);
console.log(recorded ? 'Verified completion recorded.' : 'Completion already recorded; no duplicate added.');
