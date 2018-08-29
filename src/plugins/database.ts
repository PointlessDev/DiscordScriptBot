import BotCore from '../core';
import {Message} from 'discord.js';

export function makeSandbox(_: Message, core: BotCore) {
  return {
    db: core.db.db
  };
}
