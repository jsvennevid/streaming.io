const { BaseRegistry } = require('./base');
const debug = require('debug')('streaming.io:registry:redis');
const redis = require('redis');

class RedisRegistry extends BaseRegistry {
    constructor() {
        super();
    }

    async create(options) {
        await super.create(options);

        debug("creating redis registry");

        const resolver = options.resolver || (async (host) => { throw new Error("No resolver defined"); });

        this.prefix = options.prefix;

        debug("resolving redis service");
        const service = await resolver(options.host);

        const subscriptionClient = this.subscriptionClient = redis.createClient(service.port, service.host);

        subscriptionClient.on('subscribe', (channel, count) => {
            debug("subscribed to '%s' (%d subscribers)", channel, count);
        });

        subscriptionClient.on('unsubscribe', (channel, count) => {
            debug("unsubscribed from '%s'", channel);
        });

        subscriptionClient.on('message', (channel, message) => {
            super.trigger(message);
        });

        subscriptionClient.on('ready', () => {
            debug("redis - subscription connection ready");
            subscriptionClient.subscribe(this.prefix + 'triggers');
        });

        subscriptionClient.on('error', (err) => {
            debug("error in subscription connection:", err);
        });

        const commandClient = this.commandClient = redis.createClient(service.port, service.host);
        commandClient.on('ready', () => {
            debug("redis - command connection ready");
        });

        commandClient.on('error', (err) => {
            debug("error in command connection", err);
        });
    }

    async destroy() {
        this.commandClient.end(true);
        this.subscriptionClient.end(true);
    }


    async trigger(url) {
        if (!this.commandClient) return;

        await this.__invalidate(url);

        this.commandClient.publish(this.prefix + 'triggers', url);
    }
}

exports.RedisRegistry = RedisRegistry;