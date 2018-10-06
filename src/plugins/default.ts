import BotCore from '../core';
import {Message} from 'discord.js';
import * as util from 'util';

export function makeSandbox(message: Message, core: BotCore) {
  async function runAsync(asyncFn: () => Promise<void>): Promise<void> {
    let ret;
    try {
      ret = await asyncFn();
      if (ret !== undefined) {
        message.channel.send('Async execution finished.```js\n' + util.inspect(ret).substr(0, 800) + '```');
      } else {
        message.channel.send('No explicit return value');
      }
    } catch(e) {
      message.channel.send('Async execution failed: ```js\n' + e.toString() + '```');
    }
  }
  return {
    _runAsync: (asyncFn: () => Promise<void>) => runAsync(asyncFn),
    client: core.client,
    isOwner: message.author.id === core.config.owner,
    message,
    owner: core.config.owner
  };
}
