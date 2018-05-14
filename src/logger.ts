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
  fallbackLogger: DummyLogger;
  channel: discord.TextChannel;

  constructor(private client: discord.Client,
              private config: ConfigInterface,
              private state: string
  ) {
    this.fallbackLogger = new DummyLogger('[Fallback Logger] ' + state);
    this.channel = this.client.channels.get(this.config.logChannel) as TextChannel
  }

  debug(...items: any[]) {
    this.send('Debug', items)
  }

  log(...items: any[]) {
    this.send('Log', items)
  }

  warn(...items: any[]) {
    this.send('Warn', items)
  }

  error(...items: any[]) {
    this.send('Error', items)
  }

  private send(level: ErrorLevel, items: any[]) {
    const channel = (this.client.channels.get(this.config.logChannel) as discord.TextChannel);
    if(!channel) return this.fallbackLogger[level.toLowerCase()](...items);

    items = items.map((i: any): string => inspect(i).substr(0, 500)) as string[];
    let fields = items.slice(1, 4).map(i => ({name: '​', /* zero width space */ value: i}));
    if (items.length > 3) fields.push({name: '​', /* zero width space */ value: `*+ ${items.length - 3} more*`});

    channel.send({embed: {
      author: {
        name: `[${level}]: ${this.state}`,
        icon_url: this.config.iconURL
      },
      color: ErrorColors[level],
      description: items[0],
      fields,
      footer: {
        text: `DiscordScriptBot by Pointless. Host: ${hostname()}. Env: ${process.env.ENV} V: ${require('../package.json').version}`
      }
    }})
  }
}

export class DummyLogger {
  constructor(public state: string) {}
  [key: string]: any

  debug(...items: any[]): void {
    console.debug(`[DEBUG] (${this.state}): `, ...items)
  }
  log(...items: any[]): void {
    console.log(`[LOG] (${this.state}): `, ...items)
  }
  warn(...items: any[]): void {
    console.warn(`[WARN] (${this.state}): `, ...items)
  }
  error(...items: any[]): void {
    console.log(`[ERR] (${this.state}): `, ...items)
  }
}

export default Logger;
