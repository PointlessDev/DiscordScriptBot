command('34', (m, a) => {
  if(!a[0]) return m.reply('Please provide a tag');
  const tagString = encodeURIComponent(a.contentFrom(0).join(' '));
  snekfetch.get(`https://rule34.xxx/index.php?page=dapi&s=post&q=index&limit=100&tags=${tagString}`);

});