import * as discord from 'discord.js';
import Arguments from './helpers/arguments';
import Database from './database';
import {fail, succeed} from './helpers/response';
import Logger from './helpers/logger';
import ConfigInterface from './config';
import * as util from 'util';
import moment = require('moment');
import {hostname} from 'os';
import Script from './script';
import {VM} from 'vm2';
import {CreateSandboxOptions} from './helpers/sandbox';

const ENV = process.env.NODE_ENV;

function Command(data: CommandData) {
  return function(target: BotCore, propertyKey: string) {
    target.internalCommands = target.internalCommands || {};
    target.helpInfo = target.helpInfo || [];

    let triggers = data.triggers || [propertyKey];

    const collision = triggers.find(t => !!target.internalCommands[t]);
    if(collision) {
      throw new Error(`Internal command trigger collision: Core.${propertyKey} is trying to register a ` +
        `trigger, but ${collision} already has!`);
    }
    triggers.forEach(trigger => target.internalCommands[trigger] = propertyKey);
    target.helpInfo.push({
      description: data.description,
      params: data.params,
      triggers
    });
  };
}

export type CommandFunction = (message: discord.Message, args: Arguments) => Promise<void>;
type TextBasedChannel = discord.TextChannel | discord.DMChannel | discord.GroupDMChannel;

interface ConfirmationOptions {
  user?: discord.User|string;
  confirmation?: string;
  choices?: string[];
}
interface HelpEntry {
  triggers: string[];
  description: string;
  params?: string;
}
interface CommandData {
  triggers?: string[];
  description: string;
  params?: string;
}

export default class BotCore {
  public internalCommands: {[propKey: string]: string}; // CommandName: CommandHandlerKey
  public helpInfo: HelpEntry[];
  public runningScripts: Script[] = [];
  public logger: Logger;
  public get BOT_MENTION_PATTERN(): RegExp {
    return new RegExp(`^<@!?${this.client.user.id}>$`);
  }
  [propKey: string]: CommandFunction|any;
  public db: Database;
  constructor(
    public client: discord.Client,
    public config: ConfigInterface
  ) {
    client.on('message', m => this.handleMessage(m));
    this.logger = new Logger(this, 'Core');
    this.db = new Database(this);
    this.db.connect(this.config.dbPath)
      .then(() => (ENV === 'development' && console.log('[INFO]: Connected to DB!')))
      .catch(async e => {
        this.logger.error('Failed to connect to DB!', e);
        console.error('Failed to connect to DB!');
        process.exit(1);
      });
  }

  @Command({
    description: 'This command. Lists all available system commands',
    params: '[command]'
  })
  public async help(message: discord.Message, args: Arguments): Promise<void> {
    const command = args[0];
    const info = this.getHelpInfo(command);
    if(command && !info) {
      await fail(message, 'That command does not exist! Run `@Bot help` to see all commands');
      return;
    } else if(command && info) {
      const fields = [
        {
          inline: true,
          name: 'usage:',
          value: `@Bot ${info.triggers[0]} ${info.params || ''}`
        }
      ];
      if(info.triggers.length > 1) {
        fields.push({
          inline: true,
          name: 'aliases:',
          value: info.triggers.slice(1).join(', ')
        });
      }

      message.channel.send({embed: {
        color: 0x4CAF50,
        description: info.description,
        fields,
        title: '`' + info.triggers[0] + '`',
      }});
    } else {
      message.channel.send({embed: {
        fields: this.helpInfo.map(h => ({
          name: h.triggers[0] + ' ' + (h.params || ''),
          value: h.description
        })),
        title: 'PointlessScriptBot Help'
      }});
    }
  }

  @Command({
    description: 'Prints info about the bot'
  })
  public async status(message: discord.Message, args: Arguments): Promise<void> {
    await message.channel.send({embed: {
      color: 0x4CAF50,
      description: 'DiscordScriptBot, a bot designed for extensibility and ease of modification. May contain peanuts.',
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

  @Command({
    description: 'Runs JS code, without proxied listeners available',
    params: '<code>'
  })
  public async eval(message: discord.Message, args: Arguments): Promise<void> {
    const code = args.contentFrom(0);
    const start = process.hrtime();
    let desc;
    let success = false;
    try {
      const returned = new VM(CreateSandboxOptions(message, this)).run(code);

      success = true;
      desc = util.inspect(returned).substr(0, 800);
    } catch(e) {
      desc = util.inspect(e);
    }
    const [seconds, ns] = process.hrtime(start);
    const micros = ns / 1000;
    message.channel.send({embed : {
      description: `:inbox_tray: Input:\`\`\`js\n${code}\`\`\`:outbox_tray: Output: \`\`\`${desc}\`\`\``,
      footer: {
        text: `${seconds ? seconds + 's, ' : ''}${micros}µs`
      },
      title: success ? '✅ Executed Successfully' : '❌ Execution Failed.'
    }});
  }

  @Command({
    description: 'Wraps an eval script in an async function, allowing for simple awaiting'
  })
  public async async(message: discord.Message, args: Arguments) {
    const code = '_runAsync(async () => {' + args.contentFrom(0) + '})';
    new VM(CreateSandboxOptions(message, this)).run(code);
    await succeed(message, 'Ran script in async mode!');
  }

  @Command({
    description: 'Creates or updates a script',
    params: '<name> <code>',
    triggers: ['save', 'edit', 'create', 'add']
  })
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

  @Command({
    description: 'Deletes a script from the database',
    params: '<name>',
    triggers: ['delete', 'remove']
  })
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
      confirmation: running ?
        `Script \`${name}\` is running, stop and delete?` :
        `Are you sure you want to delete \`${name}\`?`,
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
      .then(() => succeed(message, `Script ${name} deleted!`))
      .catch(async e => {
        this.logger.error(e);
        await fail(message, 'Failed to delete script. Error has been logged.');
      });
  }

  @Command({
    description: 'Runs a script',
    params: '<name>....',
    triggers: ['run', 'start']
  })
  public async run(message: discord.Message, args: Arguments): Promise<void> {
    if(!args[0]) {
      await fail(message, 'I can\'t read your mind, which script(s)?');
      return;
    }
    args.forEach(n => this.runScript(message, n));
  }

  @Command({
    description: 'Stops and re-runs a script',
    params: '<name>',
    triggers: ['restart', 'rerun']
  })
  public async restart(message: discord.Message, args: Arguments): Promise<void> {
    const name = args[0];
    if(!name) {
      await fail(message, 'It\'d be nice if you actually told me which script...');
      return;
    }
    if(this.isRunning(name)) {
      this.doStopScript(name);
    }
    await this.runScript(message, name);
  }

  @Command({
    description: 'Stops a script, and unregisters commands & listeners',
    params: '<name>',
    triggers: ['stop', 'end']
  })
  public async stop(message: discord.Message, args: Arguments): Promise<void> {
    const name = args[0];
    if(!name) {
      await fail(message, 'No script specified! Use `stopall` to stop all scripts.');
      return;
    }
    if(!this.runningScripts.find(s => s.name === name)) {
      await fail(message, 'That script doesn\'t seem to be running!');
      return;
    }
    this.doStopScript(name);
    await succeed(message, 'Script has been stopped!');
  }

  @Command({
    description: 'Stops all running scripts, and removes their commands & listeners',
    triggers: ['stopall', 'enditall']
  })
  public async stopall(message: discord.Message, args: Arguments): Promise<void> {
    if(!this.runningScripts.length) {
      await fail(message, 'No scripts are running!');
      return;
    }

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

  @Command({
    description: 'Shows details of a given script, or bot info',
    params: '[name]',
    triggers: ['info', 'details', 'script']
  })
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
    const running = this.isRunning(script.name);

    message.channel.send({embed: {
        color: 0x2196f3,
        description: '```js\n' + script.code + '```',
        fields: [
          {
            inline: true,
            name: 'Created',
            value: moment.utc(script.created).fromNow(),
          },
          {
            inline: true,
            name: 'Updated',
            value: script.updated
              ? moment.utc(script.updated).fromNow()
              : 'Never',
          }
        ],
        footer: {
          icon_url: this.config.iconURL,
          text: `DiscordScriptBot by Pointless. Host: ${hostname()}. ` +
            `Env: ${ENV} V: ${require('../package.json').version}`
        },
        title: `\`${running ? '[RUNNING] ' : ''}${script.name}\``
      }});
  }

  @Command({
    description: 'Destroys the client and starts it again',
  })
  public async reload(message: discord.Message): Promise<void> {
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

  @Command({
    description: 'Forcefully shuts down the bot!',
    triggers: ['shutdown', 'forceshutdown', 'fuckfuckfuck']
  })
  public shutdown(): void {
    console.error('[FATAL] Forcefully shutting down!', new Date());
    process.exit(0); // Don't bother with confirmation, may be time critical
  }

  @Command({
    description: 'Lists all scripts stored in the database. Use `running` to only show running scripts',
    params: '[\'running\']'
  })
  public async list(message: discord.Message, args: Arguments): Promise<void> {
    let scripts = await this.db.listScripts();
    if(args[0] && args[0].toLowerCase() === 'running') scripts = scripts.filter(s => this.isRunning(s));
    let nameList = scripts.map(s => (this.isRunning(s) ? '*' : '-') + ` ${s}\n`);

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
    if(!words[1]) return;
    let command = words[1].toLowerCase();
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
  private async runScript(message: discord.Message, name: string): Promise<void> {
    if(this.runningScripts.find(s => s.name === name)) {
      await fail(message, `Script "${name}" is already running! Make sure to \`stop\` it!`);
      return;
    }
    const script = await this.db.getScript(name);
    if(!script) {
      await fail(message, `Script "${name}" doesn't seem to exist`);
      return;
    }

    script.run(message)
      .then(async () => {
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
  private isRunning(scriptName: string): boolean {
    return !!this.runningScripts.find(s => s.name === scriptName);
  }
  private getHelpInfo(command: string): HelpEntry|void {
    return this.helpInfo.find(h => h.triggers.includes(command));
  }
}
