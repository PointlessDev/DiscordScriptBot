const {VM} = require('vm2');
const Proxy = require('./proxy');

class Script {
  constructor(db, dbObject) {
    this.name = dbObject.name;
    this.code = dbObject.code;
    this.created = dbObject.created;
    this.updated = dbObject.updated;
  }

  async run(message) { // Sure, access to this discord bot is fine, but makes it a little harder to get shell access
    const proxy = Proxy.makeProxy(message.client, this.name);
    const vm = new VM({
      timeout: 5000,
      sandbox: {message, client: message.client, proxy}
    });
    return vm.run(this.code);
  }
  async remove() {
    return await (await dbPromise).run('DELETE FROM scripts WHERE name = ?', this.name)
  }
  async update(code) {
    await (await dbPromise).run('UPDATE scripts SET code = ?, updated = ? WHERE name = ?', code, new Date(), this.name);
  }
}

module.exports = Script;
