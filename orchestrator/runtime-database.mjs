import {existsSync} from 'node:fs';
import path from 'node:path';
import {localDatabase} from './local-database.mjs';
import {database} from './database.mjs';
export function runtimeDatabase(root,config){
 const file=path.join(root,'.local','offline-queue.json');
 if(existsSync(path.join(root,'.local','offline-security-stop.json')))throw Error('Security stop: cloud authentication/access changed; saved work preserved.');
 return existsSync(file)?localDatabase(file):database(config.firebaseProjectId,config.credentialMode);
}
