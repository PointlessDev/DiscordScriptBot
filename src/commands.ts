import * as discord from 'discord.js';
import Arguments from './arguments';
import Database, {ScriptData} from './database';
import {fail, succeed} from './response';
import Logger from './logger';
import ConfigInterface from './config';
import {VM} from 'vm2';
import * as util from 'util';
import moment = require('moment');
import {hostname} from 'os';
import Script from './script';

const utcOffset = 12; // TODO Sort this out
const ENV = process.env.ENV;

function Command(triggers?: string[]) {
  return function(target: MessageHandler, propertyKey: string) {
    target.internalCommands = target.internalCommands || {};
    triggers = triggers || [propertyKey];

    const collision = triggers.find(t => !!target.internalCommands[t]);
    if(collision) {
      throw new Error(
        `Internal command trigger collision: MessageHandler.${propertyKey} is trying to register a trigger, but ${collision} already has!`
      );
    }
    triggers.forEach(trigger => target.internalCommands[trigger] = propertyKey);
  };
}

export type CommandFunction = (message: discord.Message, args: Arguments) => Promise<void>;
type TextBasedChannel = discord.TextChannel | discord.DMChannel | discord.GroupDMChannel;

interface ConfirmationOptions {
  user?: discord.User|string;
  confirmation?: string;
  choices?: string[];
}

export default class MessageHandler {
  public internalCommands: {[propKey: string]: string}; // CommandName: CommandHandlerKey
  public runningScripts: Script[] = [];
  public get BOT_MENTION_PATTERN(): RegExp {
    return new RegExp(`^<@!?${this.client.user.id}>$`);
  }
  [propKey: string]: CommandFunction|any;
  private logger: Logger;
  private db: Database;
  constructor(
    public client: discord.Client,
    public config: ConfigInterface
  ) {
    client.on('message', m => this.handleMessage(m));
    this.logger = new Logger(client, config, 'Command Handler');
    this.db = new Database(this);
    this.db.connect()
      .then(() => (ENV === 'dev' && console.log('[INFO]: Connected to DB!')))
      .catch(async e => {this.logger.error('Failed to connect to DB!', e); console.error('Failed to connect to DB!'); process.exit(1); });
  }

  @Command()
  public async status(message: discord.Message, args: Arguments): Promise<void> {
    message.channel.send({embed: {
      color: 0x4CAF50,
      description: 'DiscordScriptBot, a bot designed with extensibility and ease of modification in mind. May contain tree nuts.',
      fields: [
        {
          inline: true,
          name: 'Node.js',
          value: process.version
        },
        {
          inline: true,
          name: 'Discord.js',
          value: discord.version,
        },
        {
          inline: true,
          name: 'Env',
          value: `\`${ENV}\``
        },
        {
          inline: true,
          name: 'Host',
          value: hostname()
        },
        {
          inline: true,
          name: 'Running Scripts',
          value: this.runningScripts.length
        }
      ],
      footer: {
        text: 'Made by Pointless'
      },
      title: `DiscordScriptBot v${require('../package.json').version || 'Unknown'}`,
      url: require('../package.json').homepage
    }});
  }

  @Command(['save', 'edit', 'create', 'add'])
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

    const warn = (await this.db.isScript(name) ? 'Overwrite script' : 'Save script') + ` \`${name}\`? `;

    let choice = await this.confirmation(message.channel, {
      confirmation: warn + '```js\n' + code + '```',
      user: this.config.owner
    });
    if(choice !== '✅') {
      return;
    }

    this.db.saveScript(name, code)
      .then(() => succeed(message, `Script \`${name}\` saved!`))
      .catch(async e => {this.logger.error(e); await fail(message, 'Failed to save script. Error has been logged.'); });
  }

  @Command(['remove', 'delete'])
  public async delete(message: discord.Message, args: Arguments): Promise<void> {
    let name = args[0];
    if(!name) {
      await fail(message, 'Need a script name in order to delete it');
      return;
    }
    if(!await this.db.isScript(name)) {
      await fail(message, 'Couldn\'t find that script!');
      return;
    }

    const running = this.isRunning(name);
    let choice = await this.confirmation(message.channel, {
      choices: ['🗑', '❌'],
      confirmation: running ? `Script \`${name}\` is running, stop and delete?` : `Are you sure you want to delete \`${name}\`?`,
      user: this.config.owner
    });
    if(choice !== '🗑') {
      await fail(message, 'Cancelled!');
      return;
    }
    if(running) {
      this.doStopScript(name);
    }

    this.db.deleteScript(name)
      .then(() => succeed(message, `Script ${name} deleted!`)) // Wastebasket emoji is invisible
      .catch(async e => {this.logger.error(e); await fail(message, 'Failed to delete script. Error has been logged.'); });
  }

  @Command(['run', 'start']) // DONE
  public async run(message: discord.Message, args: Arguments): Promise<void> {
    let name = args[0];
    if(!name) {
      await fail(message, 'I can\'t read your mind, which script?');
      return;
    }
    if(this.runningScripts.find(s => s.name === name)) {
      await fail(message, 'Script is already running! Make sure to `stop` it!');
      return;
    }

    const script = await this.db.getScript(name);
    if(!script) {
      await fail(message, 'That script doesn\'t seem to exist');
      return;
    }

    script.run(message)
      .then(async () =>  {
        if(script.listening) {
          let commands = script.commands.length;
          let events = script.clientEvents.length;
          this.runningScripts.push(script);
          await succeed(message,
            `Script ${name} has been run! Registered ${commands} command${commands !== 1 ? 's' : ''} ` +
            `and ${events} client listener${events !== 1 ? 's' : ''}`
          );
        } else {
          await succeed(message, `Script ${name} has been run! No listeners registered!`);
        }
      })
      .catch(e => fail(message, `Script ${name} threw error: \`\`\`js\n${util.inspect(e).substr(0, 600)}\`\`\``));
  }

  @Command(['stop', 'end']) // DONE
  public async stop(message: discord.Message, args: Arguments): Promise<void> {
    const name = args[0];
    if(!name) {
      await fail(message, 'No script specified! Use `stopall` to stop all scripts.');
      return;
    }
    if(!this.runningScripts.find(s => s.name === name)) {
      await fail(message, 'That script doesn\'t seem to be running!');
    }
    this.doStopScript(name);
    await succeed(message, 'Script has been stopped!');
  }

  @Command(['stopall', 'enditall'])
  public async stopall(message: discord.Message, args: Arguments): Promise<void> {
    const choice = await this.confirmation(message.channel, {
      confirmation: 'Are you sure you want to stop all running scripts?',
      user: this.config.owner
    });
    if(choice !== '✅') {
      await fail(message, 'Cancelled!');
      return;
    }

    this.runningScripts.forEach(rs => this.doStopScript(rs.name));
    if(this.runningScripts.length > 0) {
      this.logger.error('Not all scripts were removed during `stopall`! Remaining:', this.runningScripts.length);
      await fail(message, 'Stopall may have failed! This error has been logged');
    } else {
      await succeed(message, 'All scripts have been stopped!');
    }
  }

  @Command(['details', 'info', 'script']) // DONE
  public async info(message: discord.Message, args: Arguments): Promise<void> {
    const name = args[0];
    if(!name) {
      return this.status(message, args);
    }

    const script = await this.db.getScript(name);
    if(!script) {
      await fail(message, 'Couldn\'t find that script');
      return;
    }
    const running = this.runningScripts.find(s => s.name === script.name);

    message.channel.send({embed: {
        color: 0x2196f3,
        description: '```js\n' + script.code + '```',
        fields: [
          {
            inline: true,
            name: 'Created',
            value: moment(script.created).add(utcOffset, 'hours').from(new Date()),
          },
          {
            inline: true,
            name: 'Updated',
            value: script.updated
              ? moment(script.updated).add(utcOffset, 'hours').from(new Date())
              : 'Never',
          }
        ],
        footer: {
          icon_url: this.config.iconURL,
          text: `DiscordScriptBot by Pointless. Host: ${hostname()}. Env: ${process.env.ENV} V: ${require('../package.json').version}`
        },
        title: `\`${running && '[RUNNING] '}${script.name}\``
      }});
  }

  @Command(['reload', 'restart']) // DONE
  public async reload(message: discord.Message, args: Arguments): Promise<void> {
    const react = await this.confirmation(message.channel, {
      confirmation: 'Are you sure you want to soft restart this bot?',
      user: this.config.owner
    });
    if(react !== '✅') {
      await fail(message, 'Cancelled!');
      return;
    }

    await message.channel.send('Goodbye.');
    this.runningScripts.forEach(rs => this.doStopScript(rs.name));
    this.client.destroy();
  }

  @Command(['shutdown', 'forceshutdown', 'fuckfuckfuck']) // DONE
  public shutdown(): void {
    console.error('[FATAL] Forcefully shutting down!', new Date());
    process.exit(0); // Don't bother with confirmation, may be time critical
  }

  @Command(['list']) // DONE
  public async list(message: discord.Message): Promise<void> {
    let scripts = await this.db.listScripts();
    let nameList = scripts.map(s =>
      (this.runningScripts.find(rs => rs.name === s) ? '*' : '-') + ` ${s}\n`
    );

    const maxLen = 20;
    if(scripts.length > maxLen) {
      let amount = nameList.length - maxLen;
      nameList.slice(0, maxLen);
      nameList.push(`\n ... ${amount} more`);
    }
    message.channel.send(`${scripts.length} scripts.\`\`\`${nameList.join('')}\`\`\``);
  }

  private handleMessage(message: discord.Message) {
    if(message.author.bot) return;
    if(!message.mentions.users.has(this.client.user.id)) return;

    let words = message.content.split(' ');
    if(!this.BOT_MENTION_PATTERN.test(words[0])) return;
    let command = words[1];
    let args = new Arguments(message, command, words.slice(2));

    if(this.internalCommands[command] && message.author.id === this.config.owner) {
      return this[this.internalCommands[command]](message, args).catch((e: Error) => this.logger.error(e));
    }

    this.runningScripts
      .forEach(s => s.runCommand(command, message, args));
  }
  private async confirmation(channel: TextBasedChannel, options: ConfirmationOptions): Promise<string|null> {
    const {choices, confirmation, user} = {
      choices: options.choices || ['❌', '✅'],
      confirmation: options.confirmation || 'Are you sure?',
      user: options.user instanceof discord.User ? options.user.id : options.user
    };
    let m = await channel.send(confirmation) as discord.Message;
    choices.forEach(async c => await m.react(c));
    let react = (await m.awaitReactions(
      (r, u) => (!user || u.id === user) && choices.includes(r.emoji.name),
      {
        max: 1,
        time: 10 * 1000
      })).first();
    await m.delete();

    return react ? react.emoji.name : null;
  }
  private doStopScript(scriptName: string): void {
    const script = this.runningScripts.find(s => s.name === scriptName);
    if(script) {
      script.stop();
      this.runningScripts.splice(this.runningScripts.indexOf(script), 1);
    }
  }
  private isRunning(scriptName: string): boolean {
    return !!this.runningScripts.forEach(s => s.name === scriptName);
  }
}
