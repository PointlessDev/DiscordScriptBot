# DiscordScriptBot

[![Build Status](https://travis-ci.org/PointlessDev/DiscordScriptBot.svg?branch=master)](https://travis-ci.org/PointlessDev/DiscordScriptBot)
[![forthebadge](https://forthebadge.com/images/badges/contains-technical-debt.svg)](https://forthebadge.com)

A Discord Bot that runs scripts loaded via discord commands. Makes changing functionality ~~easy~~ tolerable

### Configuring
Create a file in `./data` called `config.json`. The format of the config file is as follows:
```typescript
interface ConfigInterface {
  token: string; // The bot's token
  owner: string; // The ID of the bot owner, this person can use system commands
  logChannel?: string; // A Discord channel where the bot can log errors. Uses console if not provided
  iconURL?: string; // Icon url to show on system embeds
  database?: string; // Path to the SQLite DB (Defaults to ./data/db.sqlite)
}
```

### Use
In a channel with the bot, run `@Bot help`

### Oh crap, I seriously broke something
To reload the client, use `@Bot restart`, which destroys the client, and creates a new one.
If you need something more drastic, use `@Bot shutdown`, which immediately calls `process.exit`
