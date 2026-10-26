import { readFile } from 'node:fs/promises';
import { database } from '../orchestrator/database.mjs';
import { validateIdea } from '../src/ideas.js';
// Private JSON manifest: array of reviewed idea records; never commit this file.
const values=JSON.parse(await readFile(process.argv[2],'utf8'));
if(!Array.isArray(values)||!values.length||values.length>12)throw Error('Provide 1–12 reviewed proposal records.');
const rows=values.map(validateIdea);
if(new Set(rows.map(x=>x.id)).size!==rows.length)throw Error('Idea IDs must be unique.');
if(!process.env.BCC_FIREBASE_PROJECT_ID)throw Error('Set BCC_FIREBASE_PROJECT_ID locally.');
const db=database(process.env.BCC_FIREBASE_PROJECT_ID,process.env.BCC_CREDENTIAL_MODE||'firebase-cli');
const batch=db.batch();for(const {id,...value}of rows)batch.set(db.doc('ideas/'+id),value);
await batch.commit();console.log(`${rows.length} private proposal cards saved.`);await db.terminate();
