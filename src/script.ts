import {CreateSandboxOptions} from './helpers/sandbox';
import {NodeVM} from 'vm2';
import BotCore, {CommandFunction} from './core';
import {ScriptData} from './database';
import * as discord from 'discord.js';
import Arguments from './helpers/arguments';
import {fail} from './helpers/response';

interface ScriptClientListener {
  event: string;
  handler: (...args: any[]) => void;
}
interface ScriptCommand {
  triggers: string[];
  handler: CommandFunction;
}
export type EventListener = (...args: any[]) => void;

export default class Script implements ScriptData {
  public name: string;
  public code: string;
  public created: Date;
  public updated: Date;
  public listening: boolean = false;
  public commands: ScriptCommand[] = [];
  public clientEvents: ScriptClientListener[] = [];
  constructor(private data: ScriptData, private core: BotCore) {
    this.name = data.name;
    this.code = data.code;
    this.created = data.created;
    this.updated = data.updated;
  }

  public async run(message: discord.Message): Promise<void> {
    const vm = new NodeVM(CreateSandboxOptions(message, this.core, this));
    // @ts-ignore
    vm.run(this.code);
    return;
  }
  public stop(): boolean {
    this.commands = [];
    this.clientEvents.forEach(({event, handler}) => this.core.client.removeListener(event, handler));
    this.clientEvents = [];
    this.listening = false;
    return true;
  }

  public addCommand(triggers: string[], handler: CommandFunction): boolean {
    if(triggers.some(t => !!this.core.internalCommands[t])) {
      return false;
    }
    this.listening = true;
    this.commands.push({triggers, handler});
    return true;
  }
  public runCommand(trigger: string, message: discord.Message, args: Arguments): number {
    let triggered = this.commands.filter(c => c.triggers.includes(trigger));
    triggered.forEach(async c => {
      try {
        await c.handler(message, args);
      } catch(e) {
        this.core.logger.error(
          `Error in script ${this.name}. Failed to run command ${c.triggers[0]} (Triggered by: ${trigger})`,
          e
        );
        await fail(message, 'Command threw an error! This has been logged.');
      }
    });
    return triggered.length;
  }
  public addListener(event: string, handler: (...args: any[]) => void): void {
    this.listening = true;
    this.clientEvents.push({event, handler});
    this.core.client.on(event, handler);
  }
}
