import * as discord from 'discord.js';
import * as fs from 'fs';
import * as path from 'path';
import * as util from 'util';
import Logger from './logger';
import ConfigInterface from './config';
import MessageHandler from './commands';

const ENV = process.env.ENV;

interface MyClient extends discord.Client {
  lastError?: Error;
  lastWarn?: string;
}

let logger: Logger;
let client: MyClient;
let config: ConfigInterface;
let messageHandler: MessageHandler;

// Meta
async function loadConfig(): Promise<void> {
  let data = await util.promisify(fs.readFile)(path.resolve(__dirname, '../data/config.json'), 'utf8');
  config = JSON.parse(data);

  if(typeof config.owner !== 'string') {
    throw Error('Please set config.owner! (Must be a string)');
  }
  if(typeof config.token !== 'string') {
    throw Error('Missing a token to connect to bot with! (Must be a string)');
  }
}

async function start() {
  console.log(`[INFO]: Starting DiscordScriptBot in ${ENV} environment`);
  await loadConfig();

  client = new discord.Client();
  logger = new Logger(client, config, 'Main');
  messageHandler = new MessageHandler(client, config);
  client
    .on('ready', () => {
      if(ENV !== 'dev') logger.log(`Ready event emmitted`);
      console.log(`[INFO]: Ready as ${client.user.tag}`);
    })
    .on('error', e => {
      if(e.message === 'read ECONNRESET') return;
      client.lastError = e;
      logger.error('Client.error emitted! client.lastError updated', e);
    })
    .on('warn', e => {
      client.lastWarn = e;
      logger.warn('Client.warn emitted! client.lastWarn updated', e);
    })
    .on('disconnect', restart);

  await client.login(config.token);
}
function restart() {
  client = null;
  start();
}
start();

process.on('unhandledRejection', (err: Error) => (logger || console).error('Unhandled Promise Rejection:\n', err.stack));
