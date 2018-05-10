import * as discord from 'discord.js';
import Arguments from './arguments';
import {Script} from './index';
import {triggerAsyncId} from 'async_hooks';

function Command(target: MessageHandler, propertyKey: string, descriptor: TypedPropertyDescriptor<any>) {
  target.internalCommands = target.internalCommands || [];
  target.internalCommands.push(propertyKey);
}

export type CommandFunction = (message: discord.Message, args: Arguments) => Promise<void>;
interface ScriptCommand {
  id: Symbol;
  triggers: string[];
  handler: CommandFunction;
  script: Script;
}

export default class MessageHandler {
  public internalCommands: string[];
  public scriptCommands: ScriptCommand[];
  public get BOT_MENTION_PATTERN(): RegExp {
    return new RegExp(`^<@!?${this.client.user.id}>$`);
  }
  [propKey: string]: CommandFunction|any;
  constructor(private client: discord.Client) {
    client.on('message', m => this.handleMessage(m));
  }
  @Command
  public async status(message: discord.Message, args: Arguments): Promise<void> {
    message.reply(args.contentFrom(0));
  }
  private handleMessage(message: discord.Message) {
    if(message.author.bot) return;
    if(!message.mentions.users.has(this.client.user.id)) return;

    let words = message.content.split(' ');
    if(!this.BOT_MENTION_PATTERN.test(words[0])) return;
    let command = words[1];
    let args = new Arguments(message, command, words.slice(2));

    console.log(this.internalCommands);

    if(this.internalCommands.includes(command)) return this[command](message, args);

    this.scriptCommands
      .filter(s => s.triggers.includes(command))
      .forEach(s => this[command](message, args));
  }

  private addScriptCommand(script: Script, triggers: string[], handler: CommandFunction): Symbol|false {
    if(triggers.some( r => this.internalCommands.includes(r))) return false;
    const id = Symbol(script.name + ':' + triggers.toString());
    this.scriptCommands.push({id, triggers, handler, script});
    return id;
  }
}
