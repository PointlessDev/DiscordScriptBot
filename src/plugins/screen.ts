import BotCore from '../core';
import {Message} from 'discord.js';
import {spawn} from 'child_process';
import * as fs from 'fs';
import * as util from 'util';
import * as os from 'os';
import * as path from 'path';

export function makeSandbox(message: Message, core: BotCore) {
  return {
    screen: {
      list() {
        return new Promise((resolve, reject) => { // Fuck callbacks.
          const proc = spawn('screen', ['-ls']);
          let output = '';
          proc.stdout.on('data', chunk => output += chunk);
          proc.stderr.on('data', chunk => reject(new Error('`ls` failed: ' + chunk)));
          proc.on('close', () => {
            resolve(output
              .split('\n')
              .slice(1, -3)
              .map((i: string) => i.trim().split('\t')[0]));
          });
        });
      },
      async logs() {
        return (await util.promisify(fs.readdir)(os.homedir())).filter((n: string) => n.startsWith('screenlog'));
      },
      async tail(name: string, lines: number = 10) {
        return (await util.promisify(fs.readFile)(path.resolve(os.homedir(), name))).toString()
          .split('\n').slice(-lines).map(r => r.trim()).join('\n');
      }
    }
  };
}
