import { readFile, stat } from 'node:fs/promises';
import { extname } from 'node:path';
import { database } from '../orchestrator/database.mjs';
import { validatePreviewImage, validatePreviewMetadata, MAX_PREVIEW_BYTES } from '../src/previews.js';
// Usage: node scripts/upload-preview.mjs path/to/capture.json
// Manifest: file, projectId, title, caption, source, origin, capturedAt (milliseconds), reviewedSafe:true.
const manifest = JSON.parse(await readFile(process.argv[2], 'utf8'));
if (manifest.reviewedSafe !== true) throw Error('Inspect the image first: no credentials, personal data, logs or unrelated windows. Set reviewedSafe:true only after reviewing it.');
const extension = extname(manifest.file || '').toLowerCase();
if (!['.png','.jpg','.jpeg'].includes(extension)) throw Error('Upload an actual PNG or JPEG screenshot, not logs.');
const info = await stat(manifest.file);
if (!info.isFile() || info.size > MAX_PREVIEW_BYTES) throw Error('Choose a screenshot smaller than 500 KB.');
const image = validatePreviewImage(`data:${extension === '.png' ? 'image/png' : 'image/jpeg'};base64,${(await readFile(manifest.file)).toString('base64')}`);
const { projectId, title, caption, source, origin, capturedAt } = validatePreviewMetadata(manifest);
if (!process.env.BCC_FIREBASE_PROJECT_ID) throw Error('Set BCC_FIREBASE_PROJECT_ID locally.');
const db = database(process.env.BCC_FIREBASE_PROJECT_ID, process.env.BCC_CREDENTIAL_MODE || 'firebase-cli');
const ref = db.collection('previews').doc();
const batch = db.batch();
batch.create(ref, { projectId, title, caption, source, origin, capturedAt, createdAt: Date.now(), mime: image.mime, bytes: image.bytes });
batch.create(ref.collection('images').doc('main'), { dataUrl: image.dataUrl });
await batch.commit();
console.log('Private screenshot saved:', ref.id);
await db.terminate();
