import {Message} from 'discord.js';

export async function fail(message: Message, reason: string = 'Failed due to unknown reason'): Promise<Message|Message[]> {
  return message.channel.send('❌: ' + reason);
}

export async function succeed(message: Message, reason: string = 'Done!'): Promise<Message|Message[]> {
  return message.channel.send('✅: ' + reason);
}
