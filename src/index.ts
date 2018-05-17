import * as discord from 'discord.js';
import * as fs from 'fs';
import * as path from 'path';
import * as util from 'util';
import Logger from './logger';
import ConfigInterface from './config';
import MessageHandler from './commands';
import Database from './database';

const ENV = process.env.ENV;

let logger: Logger;
let client: discord.Client;
let config: ConfigInterface;
let messageHandler: MessageHandler;
let db = new Database();

// Meta
async function loadConfig(): Promise<void> {
  let data = await util.promisify(fs.readFile)(path.resolve(__dirname, 'config.json'), 'utf8');
  config = JSON.parse(data);
}

async function start() {
  console.log(`[INFO]: Starting DiscordScriptBot in ${ENV} environment`);
  await loadConfig();
  await db.connect();

  client = new discord.Client();
  logger = new Logger(client, config, 'Main');
  messageHandler = new MessageHandler(client, config, db);
  client.on('ready', () => {
    if(ENV !== 'dev') logger.log(`Ready event emmitted`);
    console.log(`[INFO]: Ready as ${client.user.tag}`);
  });

  await client.login(config.token);
}

start();

process.on('unhandledRejection', (err: Error) => console.error('Unhandled Promise Rejection:\n', err.stack));
