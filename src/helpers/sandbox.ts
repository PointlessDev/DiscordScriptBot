import * as discord from 'discord.js';
import BotCore from '../core';
import Script from '../script';
import * as path from 'path';

export interface Plugin {
  makeSandbox: (message: discord.Message, core: BotCore, script?: Script) => object;
  makeOpts?: (message: discord.Message, core: BotCore, script?: Script) => object;
}

export function CreateSandboxOptions(message: discord.Message, core: BotCore, script?: Script): object {
  let sandbox = {};
  let opts = {};
  (script ? core.config.scriptSandbox : core.config.evalSandbox).forEach(plugin => {
    const mod = require(path.resolve(__dirname, '../plugins/', plugin));
    if(mod.makeSandbox) {
      sandbox = {
        ...mod.makeSandbox(message, core, script),
        ...sandbox
      };
    }
    if(mod.makeOpts) {
      opts = {
        ...mod.makeOpts(message, core, script),
        ...opts
      };
    }
  });
  return {sandbox, ...opts};
}
