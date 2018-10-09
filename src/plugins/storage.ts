import {Message} from 'discord.js';
import BotCore from '../core';
import {Database} from 'sqlite';

const TABLE = 'storage';

export function makeSandbox(message: Message, core: BotCore) {
  const db = core.db.db;

  async function set(key: string, value: any) {
    if(!key) throw Error('Key is required');
    let editing = await db.get(`SELECT key FROM ${TABLE} WHERE key = ?`, key);
    if(editing) await db.run(`UPDATE ${TABLE} SET value = ? WHERE key = ?`, JSON.stringify(value), key);
    else await db.run(`INSERT INTO ${TABLE} (key, value) VALUES (?, ?)`, key, JSON.stringify(value));
  }
  async function get(key: string): Promise<any> {
    if(!key) throw Error('Key is required');
    const obj = await db.get(`SELECT key, value FROM ${TABLE} WHERE key = ?`, key);
    if(!obj) return obj;
    return JSON.parse(obj.value);
  }
  async function remove(key: string): Promise<void> {
    if(!key) throw Error('Key is required');
    await db.run(`DELETE FROM ${TABLE} WHERE key = ?`, key);
  }
  return {
    storage: {get, set, remove, _checkTable: () => checkTable(db)}
  };
}

async function checkTable(db: Database) {
  let exists = await db.get('SELECT name FROM sqlite_master WHERE type="table" AND name = ?', TABLE);
  if(exists) return true;
  await db.run(`CREATE TABLE ${TABLE}(
  key varchar(40),
  value varchar(3000),
  PRIMARY KEY(key)
  )`);
}
