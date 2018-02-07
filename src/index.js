/*
Add script, which uses proxied event subscription
Re-run scripts, aliased by names
Remove + update scripts
Script shutdown is key: uptime is paramount (for long duration things)
 */
const discord = require('discord.js');
const sqlite = require('sqlite');
const moment = require('moment');
const fs = require('fs');
const {VM} = require('vm2');
const Script = require('./Script');
const Proxy = require('./proxy');

class DuplicateScriptError extends Error {}
const TEST_SCRIPT_CODE = fs.readFileSync('./test-script.js');
const dbPromise = sqlite.open('./programs.sqlite', {Promise});
let db;
let client;
let config;

// Database
async function saveScript(name, code) {
  let editing = await db.get('SELECT name FROM scripts WHERE name=?', name);
  if(editing) await db.run(`UPDATE scripts SET code = ?, updated = datetime('now') WHERE name = ?`, code, name);
  else await db.run('INSERT INTO scripts(name, code, created) VALUES (?, ?, datetime(\'now\'));', name, code);
}
async function checkDb() {
  console.log('[INFO]: Checking table exists...');
  let name = await db.get('SELECT name FROM sqlite_master WHERE type=\'table\' AND name=\'scripts\'');
  if(name) console.log('[INFO]: Table exists!');
  else await initDb();
}
async function initDb() {
  console.log('[INFO]: Creating new table \'scripts\'');
  await db.exec(`CREATE TABLE scripts(
  name varchar(40),
  code varchar(2000),
  created timestamp,
  updated timestamp,
  PRIMARY KEY(name)
  );`).catch(e => {throw e});
  await saveScript('$test', TEST_SCRIPT_CODE)
    .catch(e => console.error('[ERR]: Failed to add test script to fresh db, not fatal. Stacktrace:\n', e.stack));
}
async function getScript(name) {
  const result = await db.get('SELECT name, code, created, updated FROM scripts WHERE name = ?', name)
    .catch(e => {throw e});
  if(!result) return null;
  return new Script(db, result);
}
function stopScript(name) {
  return Proxy.unregister(client, name);
}

// Bot
function loadConfig() {
  return new Promise(async (resolve) => { // Async executor because easy error handling.
    fs.readFile('./config.json', (err, data) => {
      if(err) {
        console.error('[FATAL]: Can\'t load configuration!');
        throw err;
      }
      config = JSON.parse(data); // Errors parsing it will get thrown anyway...
      resolve(config);
    })
  })
}
async function reload() {
  await client.destroy();
  await loadConfig();
  await start();
  console.log('[INFO]: Reloaded!');
  if(config.logChannel && client.channels.get(config.logChannel)) await client.channels.get(config.logChannel).send('🔄 Reloaded!')
}
function start() {
  return new Promise((resolve, reject) => { // async functions aren't really good for much are they
    client = new discord.Client();
    client.on('message', handleMessage);
    client.login(config.token);
    client.on('ready', () => {
      console.log(`[INFO]: ${client.user.tag} ready!`);
      resolve()
    })
  })
}
async function handleMessage(message) { // `@mention <command> [args...]`
  if(message.author.bot) return;
  if(message.author.id !== config.owner) return;
  if(!message.mentions.users.has(client.user.id)) return;

  const args = message.content.split(' ');

  // Check that it starts with the mention, yeah, I know it sucks.
  if(args[0] !== `<@${client.user.id}>` && args[0] !== `<@!${client.user.id}>`) return;

  // OK, it's not a bot, it's the owner, and it mentions the bot at the start

  let name = args[2] ? args[2].toLowerCase() : null;
  switch(args[1]) {
    case 'restart': // Might want this for panic reloads
    case 'shutdown':
    case 'reload':
      let channelId = message.channel.id; // Not willing to trust it still exists after client.destroy

      let confMessage = await message.channel.send('⚠ Confirm Reload?'
        + (Object.keys(Proxy.proxies).length ? ` This will terminate >${Object.keys(Proxy.proxies).length} running scripts.` : 'This may terminate non-proxied scripts!')
        + ' This will not terminate scripts with non-d.js listeners, use `@Pointless Bot#3341 hardshutdown` if required'
      );
      await confMessage.react('✅');
      await confMessage.react('❌');

      let c = (await confMessage.awaitReactions(
        (r, u) => u.id === config.owner && (r.emoji.name === '✅' || r.emoji.name === '❌'),
        {
          time: 5 * 1000,
          max: 1
        }
      )).first();
      if(!c || c.emoji.name === '❌') message.channel.send('❌ Canceled!');
      if(c.emoji.name === '✅') {
        await message.reply('🔄 Reloading!');
        await reload();
        client.channels.get(channelId).send('✅ Back online!');
      }
      break;

    case 'fuckfuckfuck':
    case 'hardshutdown':
    case 'emergencyshutdown':
      console.error('[FATAL]: Shutting down bot via discord interface!');
      process.exit(1);
      break; // You know, just in case other cases run after it shuts down

    case 'create':
    case 'edit':
    case 'make':
    case 'add':
      const code = args.slice(3).join(' ');
      if(!name || !code) return message.reply('please actually provide a script');
      if(name.length > 40) return message.reply('can you make that name a bit shorter, maybe? (ok, not maybe, just do it)');
      if(code.length > 1500) return message.reply('that script is way too long, go stick it in an uglifier');
      const overwriting = !!await getScript(name);

      let m = await message.channel.send({
        embed: {
          title: overwriting ? `⚠ Confirm *overwriting* script \`${name}\`` : `Confirm adding script \`${name}\`?`,
          description: '```js\n' + code + '```',
          color: 0x2196f3,
          footer: {
            icon_url: "https://cdn.discordapp.com/avatars/191698332014346242/036e32144c0e4df96766b51bdb71af69.png?size=2048",
            text: "Discord Script Bot v" + require('../package.json').version || 'ersion unknown'
          }
        }
      });
      await m.react('✅');
      await m.react('❌');

      let react = (await m.awaitReactions(
        (r, u) => u.id === config.owner && (r.emoji.name === '✅' || r.emoji.name === '❌'),
        {
          time: 10 * 1000,
          max: 1
        }
      )).first();
      if(!react || react.emoji.name === '❌') {
        m.delete();
        message.channel.send('❌ Canceled!');
      } else if(react.emoji.name === '✅') {
        await saveScript(name, code);
        m.delete();
        message.channel.send(`✅ Saved script \`${name}\`!`);
      }

      break;

    case 'run':
    case 'exec':
      if(!name) return message.channel.send('❌ A bot needs a name');
      const script = await getScript(name);
      if(!script) return message.channel.send(`❌ A script with the name \`${name}\` couldn't be found`);

      script.run(message);
      break;

    case 'stop':
    case 'end':
      if(!name) return message.channel.send('❌ A bot needs a name');
      const stopped = stopScript(name);
      if(stopped) {
        message.channel.send(`✅ Removed proxied handlers for script \`${name}\` on the client object. Non-proxied handlers may still be running, consider \`@Pointless Bot#3341 shutdown\``);
      } else {
        let scriptInDb = await db.get(`SELECT name FROM scripts WHERE name = ?`, name);
        if(scriptInDb) {
          message.channel.send(`⚠ No proxied event handlers were removed for \`${name}\`! If script is still running, consider \`@Pointless Bot#3341 shutdown\``);
        } else {
          message.channel.send(`⚠ No proxied handlers were removed, and \`${name}\` was not found in the DB. If script is still running, consider \`@Pointless Bot#3341 shutdown\``);
        }
      }
      break;

    case 'delete':
    case 'remove':
      (async function() {
        if(!name) return message.channel.send('❌ A bot needs a name');
        let m = await message.channel.send(`⚠ Delete script \`${name}\` (🗑), Delete + Stop script (🛑), or cancel (❌)?`);
        await m.react('🗑');
        await m.react('🛑');
        await m.react('❌');

        let react = await m.awaitReactions(
          (r, u) => u.id === config.owner && (r.emoji.name === '🗑' || r.emoji.name === '🛑' || r.emoji.name === '❌'),
          {
            time: 10 * 1000,
            max: 1
          }
        ).first();
        if(!react || react.emoji.name === '❌') message.channel.send('❌ Canceled!');

        if(react.emoji.name === '🗑') {
          await db.run('DELETE FROM script WHERE name = ?', name);
          message.channel.send(`🗑 Deleted! (Can still be stopped using \`@Pointless Bot#3341 stop ${name}\``);
        } else if(react.emoji.name === '🛑') {
          stopScript(name);
          await db.run('DELETE FROM script WHERE name = ?', name);
          message.channel.send(`✅ Removed \\\`${name}\\\` and it's proxied handlers. Non-proxied handlers may still be running, consider \\\`@Pointless Bot#3341 shutdown\\\``)
        }
      })();
      break;

    case 'eval':
      let evalCode = args.slice(2).join(' ');
      const start = process.hrtime();
      let desc;
      let success = false;
      try {
        const returned = new VM({
          timeout: 5000,
          sandbox: {message, client: message.client}
        }).run(evalCode);

        success = true;
        if(returned instanceof Object) {
          try {
            desc = 'js\n' + JSON.stringify(returned, null, 2);
          } catch(e) {
            desc = returned;
          }
        } else if(typeof returned === 'string') {
          desc = `"${returned}"`;
        } else {
          desc = returned && returned.toString ? returned.toString() : returned;
        }
      } catch(e) {
        desc = e;
      }
      const [seconds, ns] = process.hrtime(start);
      const micros = ns / 1000;
      message.channel.send({embed : {
        description: `:inbox_tray: Input:\`\`\`js\n${evalCode}\`\`\`:outbox_tray: Output: \`\`\`${desc}\`\`\``,
        footer: {
          text: `${seconds ? seconds + 's, ' : ''}${micros}µs`
        },
        title: success ? '✅ Executed Successfully' : '❌ Execution Failed.'
      }});
      break;

    case 'list':
    case 'scripts':
      let scripts = await db.all(`SELECT name FROM scripts`);

      scripts = scripts.map(s => '\n- ' + s.name);

      if(scripts.length > 15) {
        let amount = scripts.length - 15;
        scripts.slice(0, 15);
        scripts.push(`\n ... ${amount} more`);
      }
      message.channel.send(`${scripts.length} scripts.\`\`\`${scripts.join('')}\`\`\``);
      break;

    case 'script':
    case 'info':
      (async () => {
        if(!name) return message.channel.send('❌ A bot needs a name');
        const script = await getScript(name);
        if(!script) return message.channel.send('❌ Script not found.');

        message.channel.send({
          embed: {
            title: `\`${script.name}\``,
            description: '```js\n' + script.code + '```',
            fields: [
              {
                name: 'Created',
                value: moment(script.created).add(config.utcOffset, 'hours').from(new Date()),
                inline: true
              },
              {
                name: 'Updated',
                value: script.updated
                  ? moment(script.updated).add(config.utcOffset, 'hours').from(new Date())
                  : 'Never',
                inline: true
              }
            ],
            color: 0x2196f3,
            footer: {
              icon_url: "https://cdn.discordapp.com/avatars/191698332014346242/036e32144c0e4df96766b51bdb71af69.png?size=2048",
              text: "Discord Script Bot v" + require('../package.json').version || 'ersion unknown'
            }
          }
        })
      })();
      break;
  }
}
dbPromise
  .then(d => db = d)
  .then(checkDb)
  .then(loadConfig)
  .then(start);

process.on('error', err => console.error(err.stack));