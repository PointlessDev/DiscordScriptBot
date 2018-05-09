"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const util_1 = require("util");
var ErrorColors;
(function (ErrorColors) {
    ErrorColors[ErrorColors["Error"] = 16007990] = "Error";
    ErrorColors[ErrorColors["Warn"] = 16761095] = "Warn";
    ErrorColors[ErrorColors["Log"] = 5025616] = "Log";
    ErrorColors[ErrorColors["Debug"] = 240116] = "Debug";
})(ErrorColors = exports.ErrorColors || (exports.ErrorColors = {}));
class Logger {
    constructor(client, config, state) {
        this.client = client;
        this.config = config;
        this.state = state;
        this.fallbackLogger = new DummyLogger('[Fallback Logger] ' + state);
        this.channel = this.client.channels.get(this.config.logChannel);
    }
    debug(...items) {
        this.send('Debug', items);
    }
    log(...items) {
        this.send('Log', items);
    }
    warn(...items) {
        this.send('Warn', items);
    }
    error(...items) {
        this.send('Error', items);
    }
    send(level, items) {
        const channel = this.client.channels.get(this.config.logChannel);
        if (!channel)
            return this.fallbackLogger[level.toLowerCase()](...items);
        items = items.map((i) => util_1.inspect(i).substr(0, 500));
        let fields = items.slice(1, 4).map(i => ({ name: '​', value: i }));
        if (items.length > 3)
            fields.push({ name: '​', value: `*+ ${items.length - 3} more*` });
        channel.send({ embed: {
                author: {
                    name: `[${level}]: ${this.state}`,
                    icon_url: this.config.iconURL
                },
                color: ErrorColors[level],
                description: items[0],
                fields
            } });
    }
}
exports.Logger = Logger;
class DummyLogger {
    constructor(state) {
        this.state = state;
    }
    debug(...items) {
        console.debug(`[DEBUG] (${this.state}): `, ...items);
    }
    log(...items) {
        console.log(`[LOG] (${this.state}): `, ...items);
    }
    warn(...items) {
        console.warn(`[WARN] (${this.state}): `, ...items);
    }
    error(...items) {
        console.log(`[ERR] (${this.state}): `, ...items);
    }
}
exports.DummyLogger = DummyLogger;
exports.default = Logger;
//# sourceMappingURL=logger.js.map