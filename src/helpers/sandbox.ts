import * as discord from 'discord.js';
import BotCore from '../core';
import Script from '../script';
import * as path from 'path';

export interface Plugin {
  makeSandbox: (message: discord.Message, core: BotCore, script?: Script) => object;
}

export function CreateScriptSandbox(script: Script, message: discord.Message, core: BotCore): object {
  let sandbox = {};
  core.config.scriptSandbox.forEach(plugin => {
    sandbox = {
      ...require(path.resolve(__dirname, '../plugins/', plugin)).makeSandbox(message, core, script),
      ...sandbox
    };
  });
  return sandbox;
}

export function CreateEvalSandbox(message: discord.Message, core: BotCore): object {
  let sandbox = {};
  core.config.evalSandbox.forEach(plugin => {
    sandbox = {
      ...require(path.resolve(__dirname, '../plugins/', plugin)).makeSandbox(message, core),
      ...sandbox
    };
  });
  return sandbox;
}
