export interface ConfigInterface {
  token: string; // The bot's token
  owner: string; // The ID of the bot owner, this person can use system commands
  logChannel?: string; // A Discord channel where the bot can log errors. Uses console if not provided
  iconURL?: string; // Icon url to show on system embeds
  dbPath?: string; // Path to the SQLite DB (Defaults to ./data/db.sqlite)
  evalSandbox?: string[];
  scriptSandbox?: string[];
}

export default ConfigInterface;
