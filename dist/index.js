"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const discord = require("discord.js");
const sqlite = require("sqlite");
const fs = require("fs");
const path = require("path");
const logger_1 = require("./logger");
const util = require("util");
const commands_1 = require("./commands");
const TEST_SCRIPT_CODE = fs.readFileSync(path.resolve(__dirname, 'test-script.js'), 'utf8');
const dbPromise = sqlite.open('./programs.sqlite', { promise: Promise });
let logger;
let db;
let client;
let config;
let messageHandler;
async function loadConfig() {
    let data = await util.promisify(fs.readFile)(path.resolve(__dirname, 'config.json'), 'utf8');
    config = JSON.parse(data);
}
async function checkDb() {
    console.log('[INFO]: Checking table exists...');
    let name = await db.get('SELECT name FROM sqlite_master WHERE type=\'table\' AND name=\'scripts\'');
    if (name)
        console.log('[INFO]: Table exists!');
    else
        await initDb();
}
async function initDb() {
    console.log('[INFO]: Creating new table \'scripts\'');
    await db.exec(`CREATE TABLE scripts(
  name varchar(40),
  code varchar(2000),
  created timestamp,
  updated timestamp,
  PRIMARY KEY(name)
  );`).catch(e => { throw e; });
    await saveScript('$test', TEST_SCRIPT_CODE)
        .catch((e) => console.error('[ERR]: Failed to add test script to fresh db, not fatal. Stacktrace:\n', e.stack));
}
async function getScript(name) {
    return db.get('SELECT name, code, created, updated FROM scripts WHERE name = ?', name)
        .catch(e => { throw e; });
}
async function saveScript(name, code) {
    let editing = await db.get('SELECT name FROM scripts WHERE name=?', name);
    if (editing)
        await db.run(`UPDATE scripts SET code = ?, updated = datetime('now') WHERE name = ?`, code, name);
    else
        await db.run('INSERT INTO scripts(name, code, created) VALUES (?, ?, datetime(\'now\'));', name, code);
}
async function start() {
    await loadConfig();
    await checkDb();
    client = new discord.Client();
    logger = new logger_1.default(client, config, 'Main');
    messageHandler = new commands_1.default(client);
    client.on('ready', () => {
        logger.log(`Ready event emmitted`);
    });
    await client.login(config.token);
}
dbPromise
    .then(d => db = d)
    .then(start);
process.on('error', (err) => console.error(err.stack));
//# sourceMappingURL=index.js.map