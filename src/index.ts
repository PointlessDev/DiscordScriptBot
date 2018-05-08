/*
Add script, which uses proxied event subscription
Re-run scripts, aliased by names
Remove + update scripts
Script shutdown is key: uptime is paramount (for long duration things)
 */
import * as discord from 'discord.js';
import * as sqlite from 'sqlite';
import * as moment from 'moment';
import * as fs from 'fs';
import * as path from 'path';
import {VM} from 'vm2';
import ScriptAPI from './scriptapi';
import Logger from './logger';
import ConfigInterface from './config';

const TEST_SCRIPT_CODE = fs.readFileSync(path.resolve(__dirname, 'test-script.js'), 'utf8');
const dbPromise = sqlite.open('./programs.sqlite', {promise: Promise});

let logger: Logger;
let db: sqlite.Database;
let client: discord.Client;
let config: ConfigInterface;

interface Script {
  name: string;
  code: string;
  created: Date;
  updated?: Date
}

// Meta
function loadConfig() {
  return new Promise((resolve, reject) => { // Async executor because easy error handling.
    fs.readFile(path.resolve(__dirname, 'config.json'), 'utf8', (err, data) => {
      if(err) {
        console.error('[FATAL]: Can\'t load configuration!');
        throw err;
      }
      try {
        config = JSON.parse(data); // Errors parsing it will get thrown anyway...
      } catch(e) {
        return reject(e)
      }
      resolve(config);
    })
  })
}


// Database
async function checkDb() {
  console.log('[INFO]: Checking table exists...');
  let name = await db.get('SELECT name FROM sqlite_master WHERE type=\'table\' AND name=\'scripts\'');
  if(name) console.log('[INFO]: Table exists!');
  else await initDb();
}
async function initDb() {
  console.log('[INFO]: Creating new table \'scripts\'');
  await db.exec(`CREATE TABLE scripts(
  name varchar(40),
  code varchar(2000),
  created timestamp,
  updated timestamp,
  PRIMARY KEY(name)
  );`).catch(e => {throw e});
  await saveScript('$test', TEST_SCRIPT_CODE)
    .catch((e: Error) => console.error('[ERR]: Failed to add test script to fresh db, not fatal. Stacktrace:\n', e.stack));
}

async function getScript(name: string): Promise<Script> {
  return db.get('SELECT name, code, created, updated FROM scripts WHERE name = ?', name)
    .catch(e => {throw e});
}
async function saveScript(name: string, code: string): Promise<void> {
  let editing = await db.get('SELECT name FROM scripts WHERE name=?', name);
  if(editing) await db.run(`UPDATE scripts SET code = ?, updated = datetime('now') WHERE name = ?`, code, name);
  else await db.run('INSERT INTO scripts(name, code, created) VALUES (?, ?, datetime(\'now\'));', name, code);
}

function start() {
  return new Promise((resolve, reject) => { // async functions aren't really good for much are they
    client = new discord.Client();
    client.on('message', handleMessage);
    client.login(config.token);
    client.on('ready', () => {
      console.log(`[INFO]: ${client.user.tag} ready!`);
      resolve()
    })
  })
}

dbPromise
  .then(d => db = d)
  .then(loadConfig)
  .then(() => logger = new Logger(db, config, 'Main'))
  .then(checkDb)
  .then(start);

process.on('error', (err: Error) => console.error(err.stack));
