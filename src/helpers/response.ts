import {Message} from 'discord.js';

export async function fail(message: Message, reason?: string): Promise<Message|Message[]> {
  return message.channel.send('❌: ' + (reason || 'Failed due to an unknown reason'));
}

export async function succeed(message: Message, reason: string = 'Done!'): Promise<Message|Message[]> {
  return message.channel.send('✅: ' + reason);
}
