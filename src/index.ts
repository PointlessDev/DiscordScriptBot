import * as discord from 'discord.js';
import * as sqlite from 'sqlite';
import * as moment from 'moment';
import * as fs from 'fs';
import * as path from 'path';
import {VM} from 'vm2';
// import ScriptAPI from './scriptapi';
import Logger from './logger';
import ConfigInterface from './config';
import * as util from 'util';
import MessageHandler from './commands';

const TEST_SCRIPT_CODE = fs.readFileSync(path.resolve(__dirname, 'test-script.js'), 'utf8');
const dbPromise = sqlite.open('./programs.sqlite', {promise: Promise});

let logger: Logger;
let db: sqlite.Database;
let client: discord.Client;
let config: ConfigInterface;
let messageHandler: MessageHandler;

interface Script {
  name: string;
  code: string;
  created: Date;
  updated?: Date;
}

// Meta
async function loadConfig(): Promise<void> {
  let data = await util.promisify(fs.readFile)(path.resolve(__dirname, 'config.json'), 'utf8');
  config = JSON.parse(data);
}

// Database
async function checkDb(): Promise<void> {
  console.log('[INFO]: Checking table exists...');
  let name = await db.get('SELECT name FROM sqlite_master WHERE type=\'table\' AND name=\'scripts\'');
  if(name) console.log('[INFO]: Table exists!');
  else await initDb();
}
async function initDb(): Promise<void> {
  console.log('[INFO]: Creating new table \'scripts\'');
  await db.exec(`CREATE TABLE scripts(
  name varchar(40),
  code varchar(2000),
  created timestamp,
  updated timestamp,
  PRIMARY KEY(name)
  );`).catch(e => {throw e; });
  await saveScript('$test', TEST_SCRIPT_CODE)
    .catch((e: Error) => console.error('[ERR]: Failed to add test script to fresh db, not fatal. Stacktrace:\n', e.stack));
}

async function getScript(name: string): Promise<Script> {
  return db.get('SELECT name, code, created, updated FROM scripts WHERE name = ?', name)
    .catch(e => {throw e; });
}
async function saveScript(name: string, code: string): Promise<void> {
  let editing = await db.get('SELECT name FROM scripts WHERE name=?', name);
  if(editing) await db.run(`UPDATE scripts SET code = ?, updated = datetime('now') WHERE name = ?`, code, name);
  else await db.run('INSERT INTO scripts(name, code, created) VALUES (?, ?, datetime(\'now\'));', name, code);
}

async function start() {
  await loadConfig();
  await checkDb();

  client = new discord.Client();
  logger = new Logger(client, config, 'Main');
  messageHandler = new MessageHandler(client);
  client.on('ready', () => {
    logger.log(`Ready event emmitted`);
  });

  await client.login(config.token);
}

dbPromise
  .then(d => db = d)
  .then(start);

process.on('error', (err: Error) => console.error(err.stack));
