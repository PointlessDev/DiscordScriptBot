# DiscordScriptBot

[![Build Status](https://travis-ci.org/PointlessDev/DiscordScriptBot.svg?branch=master)](https://travis-ci.org/PointlessDev/DiscordScriptBot)
[![Dependency Status](https://www.versioneye.com/user/projects/5b00f5870fb24f0e5baacc76/badge.svg?style=flat)](https://www.versioneye.com/user/projects/5b00f5870fb24f0e5baacc76)

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
In a channel with the bot, run `@Bot help`. All code is sandboxed, using either an eval or script sandbox. The eval sandbox is:

```typescript
interface Sandbox {
  owner: string;
  isOwner: boolean;
  client: discord.Client;
  message: discord.Message;
}
```

Script sandboxes have access everything in an eval sandbox, plus two event registering functions. `proxy()` adds a removable listener to the client.
`command()` is also available, which registers commands to be invoked using `@Bot command args`.

```typescript
type CommandFunction = (message: discord.Message, args: Arguments) => void;

interface ScriptSandbox extends Sandbox {
  command: (triggers: string|string[], handler: CommandFunction) => boolean;
  proxy: (event: string, listener: EventListener) => void;
}
```

#### Stopping Scripts
The reason that the proxy function exists is so that a script can be shutdown properly. When a script gets shutdown, all commands and listeners registered via `proxy` will be removed.
*However,* if any event listeners were registered using `client.on`, these will not be removed, and will continue to be called!

### Oh crap, I seriously broke something
To reload the client, use `@Bot restart`, which destroys the client, and creates a new one.
If you need something more drastic, use `@Bot shutdown`, which immediately calls `process.exit`
