"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
Object.defineProperty(exports, "__esModule", { value: true });
const discord = require("discord.js");
const arguments_1 = require("./arguments");
function Command() {
    return function (target, propertyKey) {
        console.log(target);
        console.log(propertyKey);
        target.commands.push(propertyKey);
    };
}
class MessageHandler {
    constructor(client) {
        this.client = client;
        this.commands = [];
        client.on('message', m => this.handleMessage(m));
        this.BOT_MENTION_PATTERN = new RegExp(`<@!?${this.client.user.id}>`);
    }
    handleMessage(message) {
        if (message.author.bot)
            return;
        if (!message.mentions.users.has(this.client.user.id))
            return;
        let words = message.content.split(' ');
        if (!this.BOT_MENTION_PATTERN.test(words[0]))
            return;
        let command = words[1];
        let args = new arguments_1.default(message, command, words.slice(2));
        if (this.commands.indexOf(command) > -1)
            this[command](message, args);
    }
    async status(message, args) {
        message.reply(args.contentFrom(0));
    }
}
__decorate([
    Command,
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [discord.Message, arguments_1.default]),
    __metadata("design:returntype", Promise)
], MessageHandler.prototype, "status", null);
exports.default = MessageHandler;
//# sourceMappingURL=commands.js.map