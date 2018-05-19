import * as discord from 'discord.js';
import ConfigInterface from './config';
import {inspect} from 'util';
import {TextChannel} from 'discord.js';
import {hostname} from 'os';

export type ErrorLevel = 'Error' | 'Warn' | 'Log' | 'Debug';

export enum ErrorColors {
  'Error' = 0xF44336,
  'Warn' = 0xFFC107,
  'Log' = 0x4CAF50,
  'Debug' = 0x03A9F4
}

export class Logger {
  public channel: discord.TextChannel;
  private readonly fallbackLogger: DummyLogger;

  constructor(private client: discord.Client,
              private config: ConfigInterface,
              private state: string
  ) {
    this.fallbackLogger = new DummyLogger('[Fallback Logger] ' + state);
    this.channel = this.client.channels.get(this.config.logChannel) as TextChannel;
  }

  public debug(...items: any[]) {
    this.send('Debug', items);
  }
  public log(...items: any[]) {
    this.send('Log', items);
  }
  public warn(...items: any[]) {
    this.send('Warn', items);
  }
  public error(...items: any[]) {
    this.send('Error', items);
  }

  private send(level: ErrorLevel, items: any[]) {
    const channel = (this.client.channels.get(this.config.logChannel) as discord.TextChannel);
    if(!channel) return this.fallbackLogger[level.toLowerCase()](...items);

    items = items.map((i: any): string => '```js\n' + inspect(i).substr(0, 500) + '```') as string[];
    let fields = items.slice(1, 4).map(i => ({name: '​', /* zero width space */ value: i}));
    if (items.length > 3) fields.push({name: '​', /* zero width space */ value: `*+ ${items.length - 3} more*`});
    let envText = process.env.ENV && '. Env: ' + process.env.ENV;

    channel.send({embed: {
      author: {
        icon_url: this.config.iconURL,
        name: `[${level}]: ${this.state}`
      },
      color: ErrorColors[level],
      description: items[0],
      fields,
      footer: {
        text: `DiscordScriptBot by Pointless. Host: ${hostname()}${envText}. V: ${require('../package.json').version}`
      }
    }});
  }
}

export class DummyLogger {
  constructor(public state: string) {}
  [key: string]: any

  public debug(...items: any[]): void {
    console.log(`[DEBUG] (${this.state}): `, ...items); // Log because debug isn't allowed
  }
  public log(...items: any[]): void {
    console.log(`[LOG] (${this.state}): `, ...items);
  }
  public warn(...items: any[]): void {
    console.warn(`[WARN] (${this.state}): `, ...items);
  }
  public error(...items: any[]): void {
    console.log(`[ERR] (${this.state}): `, ...items);
  }
}

export default Logger;
