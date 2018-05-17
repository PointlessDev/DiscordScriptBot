import * as sqlite from 'sqlite';
import * as fs from 'fs';
import * as path from 'path';
import Script from './script';
import ConfigInterface from './config';
import MessageHandler from './commands';

export interface ScriptData {
  name: string;
  code: string;
  created: Date;
  updated?: Date;
}

export default class Database {
  public db: sqlite.Database;
  public filename: string;
  constructor(private messageHandler: MessageHandler) {}
  public async connect(filename: string = './programs.sqlite') {
    this.filename = filename;
    this.db = await sqlite.open(filename, {promise: Promise});
    await this.checkDb();
  }

  public async isScript(name: string): Promise<boolean> {
    return !!await this.db.get('SELECT name FROM scripts WHERE name = ?', name);
  }
  public async getScript(name: string): Promise<Script|void> {
    const scriptData = await this.db.get('SELECT name, code, created, updated FROM scripts WHERE name = ?', name)
      .catch(e => {throw e; });
    return scriptData ? new Script(scriptData, this.messageHandler) : null;
  }
  public async listScripts(): Promise<string[]> {
    return (await this.db.all('SELECT name FROM scripts')).map(s => s.name);
  }
  public async saveScript(name: string, code: string): Promise<void> {
    let editing = await this.db.get('SELECT name FROM scripts WHERE name=?', name);
    if(editing) await this.db.run(`UPDATE scripts SET code = ?, updated = datetime('now') WHERE name = ?`, code, name);
  else await this.db.run('INSERT INTO scripts(name, code, created) VALUES (?, ?, datetime(\'now\'));', name, code);
  }
  public async deleteScript(name: string): Promise<void> {
    await this.db.run('DELETE FROM scripts WHERE name = ?', name);
    return;
  }

  public async checkDb(): Promise<void> {
    console.log('[INFO]: Checking table exists...');
    let name = await this.db.get('SELECT name FROM sqlite_master WHERE type=\'table\' AND name=\'scripts\'');
    if(name) console.log('[INFO]: Table exists!');
    else await this.initDb();
  }
  public async initDb(): Promise<void> {
    console.log('[INFO]: Creating new table \'scripts\'');
    await this.db.exec(`CREATE TABLE scripts(
  name varchar(40),
  code varchar(2000),
  created timestamp,
  updated timestamp,
  PRIMARY KEY(name)
  );`).catch(e => {throw e; });

    const TEST_SCRIPT_CODE = fs.readFileSync(path.resolve(__dirname, 'test-script.js'), 'utf8');
    await this.saveScript('$test', TEST_SCRIPT_CODE)
      .catch((e: Error) => console.error('[ERR]: Failed to add test script to fresh db, not *technically* fatal. Stacktrace:\n', e.stack));
  }
}
