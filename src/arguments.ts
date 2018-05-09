/**
 * Created by Pointless on 16/07/17.
 */
import {Message} from 'discord.js';

class Arguments extends Array<string> {
  constructor(
    public message: Message,
    public command: string,
    private args: string[],
  ) {
    super(...(args || []));
  }

  public contentFrom(position: number): string {
    return this.args.slice(position).join(' ');
  }
}

export default Arguments;
