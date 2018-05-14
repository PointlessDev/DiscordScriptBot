if(proxy && command && client && message) {
  message.reply(`✅ Things seem to be working, proxy exists`);
}else {
  message.reply(`❌ Online, but some sandbox variables are missing. Check recent changes.`);
}
