import CreateScriptSandbox from './sandbox';
import {VM} from 'vm2';
import MessageHandler, {CommandFunction} from './commands';
import {ScriptData} from './database';
import * as discord from 'discord.js';
import Arguments from './arguments';

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
  public running: boolean;
  private commands: ScriptCommand[];
  private clientEvents: ScriptClientListener[];
  constructor(private data: ScriptData, private messageHandler: MessageHandler) {
    this.name = data.name;
    this.code = data.code;
    this.created = data.created;
    this.updated = data.updated;
  }

  public async run(message: discord.Message): Promise<void> {
    this.running = true;
    const vm = new VM({
      sandbox: CreateScriptSandbox(this, message, this.messageHandler.config.owner),
      timeout: 5000
    });
    return vm.run(this.code);
  }
  public stop(): boolean {
    this.commands = [];
    this.clientEvents.forEach(({event, handler}) => this.messageHandler.client.removeListener(event, handler));
    this.clientEvents = [];
    this.running = false;
    return true;
  }

  public addCommand(triggers: string[], handler: CommandFunction): boolean {
    if(triggers.some(t => !!this.messageHandler.internalCommands[t])) {
      return false;
    }
    this.commands.push({triggers, handler});
    return true;
  }
  public runCommand(trigger: string, message: discord.Message, args: Arguments): number {
    let triggered = this.commands.filter(c => c.triggers.includes(trigger));
    triggered.forEach(c => c.handler(message, args));
    return triggered.length;
  }
  public addListener(event: string, handler: (...args: any[]) => void): void {
    this.clientEvents.push({event, handler});
    this.messageHandler.client.on(event, handler);
  }
}
