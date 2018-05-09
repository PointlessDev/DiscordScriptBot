import * as discord from 'discord.js';
import Arguments from './arguments';

function Command() {
  return function(target: MessageHandler, propertyKey: string) {
    console.log(target);
    console.log(propertyKey);
    target.commands.push(propertyKey);
  };
}

export type CommandHandler = (message: discord.Message, args: Arguments) => Promise<void>;

export default class MessageHandler {
  public commands: string[] = [];
  public BOT_MENTION_PATTERN: RegExp;
  [propKey: string]: CommandHandler|any;
  constructor(private client: discord.Client) {
    client.on('message', m => this.handleMessage(m));
    this.BOT_MENTION_PATTERN = new RegExp(`<@!?${this.client.user.id}>`);
  }
  private handleMessage(message: discord.Message) {
    if(message.author.bot) return;
    if(!message.mentions.users.has(this.client.user.id)) return;

    let words = message.content.split(' ');

    if(!this.BOT_MENTION_PATTERN.test(words[0])) return;

    let command = words[1];
    let args = new Arguments(message, command, words.slice(2));

    if(this.commands.indexOf(command) > -1) this[command](message, args);
  }
  @Command
  public async status(message: discord.Message, args: Arguments): Promise<void> {
    message.reply(args.contentFrom(0));
  }
}
