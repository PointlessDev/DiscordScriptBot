import BotCore, {CommandFunction} from '../core';
import Script, {EventListener} from '../script';
import {Message} from 'discord.js';

export function makeSandbox(message: Message, core: BotCore, script: Script) {
  if(!script) throw new Error('Listeners plugin can only be used in a script context!');
  function addCommand(triggers: string|string[], handler: CommandFunction): boolean {
    let added = script.addCommand(Array.isArray(triggers) ? triggers : [triggers], handler);
    if(!added) {
      message.channel.send(`Could not register command with triggers [${triggers}]. ` +
        `A trigger conflicts with an internal command`);
    }
    return added;
  }
  function addListener(event: string, listener: EventListener) {
    script.addListener(event, listener);
  }
  return {
    command: (triggers: string|string[], handler: CommandFunction) => addCommand(triggers, handler),
    proxy: (event: string, listener: EventListener) => addListener(event, listener),
  };
}
