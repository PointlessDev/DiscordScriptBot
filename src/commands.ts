import * as discord from 'discord.js';
import Arguments from './arguments';
import Database, {Script} from './database';
import {fail, succeed} from './response';
import Logger from './logger';
import ConfigInterface from './config';
import {VM} from 'vm2';
import CreateScriptSandbox from './sandbox';
import * as util from 'util';
import moment = require('moment');
import {hostname} from "os";

const utcOffset = 12; // TODO Sort this out

function Command(triggers?: string[]) {
  return function(target: MessageHandler, propertyKey: string) {
    target.internalCommands = target.internalCommands || {};
    triggers = triggers || [propertyKey];

    const collision = triggers.find(t => !!target.internalCommands[t]);
    if(collision)
      throw new Error(`Internal command trigger collision: MessageHandler.${propertyKey} is trying to register a trigger, but ${collision} already has!`);
    triggers.forEach(trigger => target.internalCommands[trigger] = propertyKey);
  }
}

export type CommandFunction = (message: discord.Message, args: Arguments) => Promise<void>;
interface ScriptCommand {
  id: Symbol;
  triggers: string[];
  handler: CommandFunction;
  script: Script;
}

export default class MessageHandler {
  public internalCommands: {[propKey: string]: string};
  public scriptCommands: ScriptCommand[];
  public get BOT_MENTION_PATTERN(): RegExp {
    return new RegExp(`^<@!?${this.client.user.id}>$`);
  }
  [propKey: string]: CommandFunction|any;
  private logger: Logger;
  constructor(
    private client: discord.Client,
    private config: ConfigInterface,
    private db: Database
  ) {
    client.on('message', m => this.handleMessage(m));
    this.logger = new Logger(client, config, 'Command Handler')
  }

  @Command()
  public async echo(message: discord.Message, args: Arguments): Promise<void> {
    await message.reply(args.contentFrom(0));
  }

  @Command(['save', 'edit', 'create'])
  public async save(message: discord.Message, args: Arguments): Promise<void> {
    let name = args[0];
    let code = args.contentFrom(1);
    if(!name) {
      await fail( message, 'A script needs a name');
      return;
    }
    if(!code) {
      await fail(message, 'A script needs a script!');
      return;
    }

    // TODO Check if script exists, change confirmation message accordingly
    // TODO Confirmation Message

    this.db.saveScript(name, code)
      .then(() => succeed(message, `Script ${name} saved!`))
      .catch(e => {this.logger.error(e); fail(message, 'Failed to save script. Error has been logged.')})
  }

  @Command(['remove', 'delete'])
  public async delete(message: discord.Message, args: Arguments): Promise<void> {
    let name = args[0];
    if(!name) {
      await fail(message, 'Need a script name in order to delete it');
      return;
    }

    // TODO Confirmation Message
    // TODO Stop script before deletion
    // TODO Check if script exists, and change output accordingly

    this.db.deleteScript(name)
      .then(() => message.reply(`🗑: Script ${name} deleted!`)) // Wastebasket emoji is invisible
      .catch(e => {this.logger.error(e); fail(message, 'Failed to delete script. Error has been logged.')})
  }

  @Command(['run', 'start'])
  public async run(message: discord.Message, args: Arguments): Promise<void> {
    let name = args[0];
    if(!name) {
      await fail(message, 'I can\'t read your mind, which script?');
      return;
    }

    const script = await this.db.getScript(name);
    if(!script) {
      await fail(message, 'That script doesn\'t seem to exist');
      return;
    }

    this.runInSandbox(script.code, CreateScriptSandbox(script, message, this.config.owner, this))
      .then(() =>  succeed(message, `Script ${name} has been run!`))
      .catch(e => fail(message, `Script ${name} threw error: \`\`\`js\n${util.inspect(e).substr(0, 600)}\`\`\``))
  }

  @Command(['details', 'info', 'script'])
  public async info(message: discord.Message, args: Arguments): Promise<void> {
    const name = args[0];
    if(!name) {
      await fail(message, 'Can\'t get info about nothing?!');
      return;
    }

    const script = await this.db.getScript(name);
    if(!script) {
      await fail(message, 'Couldn\'t find that script');
      return;
    }

    message.channel.send({embed: {
        title: `\`${script.name}\``,
        description: '```js\n' + script.code + '```',
        fields: [
          {
            name: 'Created',
            value: moment(script.created).add(utcOffset, 'hours').from(new Date()),
            inline: true
          },
          {
            name: 'Updated',
            value: script.updated
              ? moment(script.updated).add(utcOffset, 'hours').from(new Date())
              : 'Never',
            inline: true
          }
        ],
        color: 0x2196f3,
        footer: {
          icon_url: this.config.iconURL,
          text: `DiscordScriptBot by Pointless. Host: ${hostname()}. Env: ${process.env.ENV} V: ${require('../package.json').version}`
        }
      }})
  }

  private runInSandbox(code: string, sandbox: object): Promise<any> {
    const vm = new VM({timeout: 5000, sandbox});
    return vm.run(code)
  }

  private handleMessage(message: discord.Message) {
    if(message.author.bot) return;
    if(!message.mentions.users.has(this.client.user.id)) return;

    let words = message.content.split(' ');
    if(!this.BOT_MENTION_PATTERN.test(words[0])) return;
    let command = words[1];
    let args = new Arguments(message, command, words.slice(2));

    if(this.internalCommands[command] && message.author.id == this.config.owner)
      return this[command](message, args).catch((e: Error) => this.logger.error(e));

    this.scriptCommands
      .filter(s => s.triggers.includes(command))
      .forEach(s => s.handler(message, args));
  }

  public addScriptCommand(script: Script, triggers: string[], handler: CommandFunction): Symbol|false {
    if(triggers.some( r => !!this.internalCommands[r])) return false;
    const id = Symbol(script.name + ':' + triggers.toString());
    this.scriptCommands.push({id, triggers, handler, script});
    return id;
  }

  // TODO addScriptClientListener

  // TODO removeScriptListeners
}
