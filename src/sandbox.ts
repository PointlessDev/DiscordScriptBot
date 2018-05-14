import {Script} from './database';
import * as discord from 'discord.js';
import {CommandFunction, default as MessageHandler} from './commands';

export interface ScriptSandbox extends Sandbox {
  command: (triggers: string|string[], handler: CommandFunction) => void
  proxy: (event: string, listener: Function) => void
}

export interface Sandbox {
  owner: string;
  isOwner: boolean;
  client: discord.Client;
  message: discord.Message;
}

export function CreateScriptSandbox(script: Script, message: discord.Message, owner: string, messageHandler: MessageHandler): ScriptSandbox {
  function addCommand(triggers: string|string[], handler: CommandFunction) {
    messageHandler.addScriptCommand(script, Array.isArray(triggers) ? triggers : [triggers], handler)
  }

  function addListener(event: string, listener: Function) {
    messageHandler.addScriptClientListener(script, event, listener);
  }

  return {
    owner,
    isOwner: message.author.id === owner,
    client: message.client,
    message,
    command: (triggers, handler) => addCommand(triggers, handler),
    proxy: (event, listener) => addListener(event, listener)
  }
}

export function CreateEvalSandbox(message: discord.Message, owner: string): Sandbox {
  return {
    owner,
    isOwner: message.author.id === owner,
    client: message.client,
    message
  }
}

export default CreateScriptSandbox;
