const Proxy = {
  proxies: {},
  makeProxy: function makeProxy(client, name) {
    return function(event, handler) {
      Proxy.proxies[name] = Proxy.proxies[name] || [];
      Proxy.proxies[name].push({event, handler});
      client.on(event, handler);
    }
  },
  unregister(client, name) {
    if(Proxy.proxies[name]) {

      Proxy.proxies[name].forEach(({event, handler}) => {
        client.removeListener(event, handler)
      });
      delete Proxy.proxies[name];
      return true;
    } else {
      return false;
    }
  }
};

module.exports = Proxy;
