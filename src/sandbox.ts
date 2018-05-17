import * as discord from 'discord.js';
import {CommandFunction} from './commands';
import Script, {EventListener} from './script';

export interface ScriptSandbox extends Sandbox {
  command: (triggers: string|string[], handler: CommandFunction) => boolean;
  proxy: (event: string, listener: EventListener) => void;
}

export interface Sandbox {
  owner: string;
  isOwner: boolean;
  client: discord.Client;
  message: discord.Message;
}

export function CreateScriptSandbox(script: Script, message: discord.Message, owner: string): ScriptSandbox {
  function addCommand(triggers: string|string[], handler: CommandFunction): boolean {
    let added = script.addCommand(Array.isArray(triggers) ? triggers : [triggers], handler);
    if(!added) {
      message.channel.send(`Could not register command with triggers [${triggers}]. A trigger conflicts with an internal command`);
    }
    return added;
  }

  function addListener(event: string, listener: EventListener) {
    script.addListener(event, listener);
  }

  return {
    client: message.client,
    command: (triggers, handler) => addCommand(triggers, handler),
    isOwner: message.author.id === owner,
    message,
    owner: owner,
    proxy: (event, listener) => addListener(event, listener)
  };
}

export function CreateEvalSandbox(message: discord.Message, owner: string): Sandbox {
  return {
    client: message.client,
    isOwner: message.author.id === owner,
    message,
    owner
  };
}

export default CreateScriptSandbox;
