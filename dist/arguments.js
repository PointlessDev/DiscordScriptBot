"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
class Arguments extends Array {
    constructor(message, command, args) {
        super(...(args || []));
        this.message = message;
        this.command = command;
        this.args = args;
    }
    contentFrom(position) {
        return this.args.slice(position).join(' ');
    }
}
exports.default = Arguments;
//# sourceMappingURL=arguments.js.map