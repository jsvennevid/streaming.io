const { Registry } = require('./base');
const debug = require('debug')('streaming.io:registry:redis');
const redis = require('redis');

class RedisRegistry extends Registry {
    constructor() {
        super();
    }

    async create(options) {
        await super.create(options);

        debug("creating redis registry");

        const resolver = options.resolver || (async (host) => { throw new Error("No resolver defined"); });

        this.prefix = options.prefix ? options.prefix + '-' : '';
        this.topic = this.prefix + 'triggers';

        debug("resolving redis service");
        const service = await resolver(options.host);

        const subscriptionClient = this.subscriptionClient = redis.createClient(service.port, service.host);

        subscriptionClient.on('subscribe', (channel, count) => {
            debug("subscribed to '%s' (%d subscribers)", channel, count);
            this.emit('redis:subscribed', channel);
        });

        subscriptionClient.on('unsubscribe', (channel, count) => {
            debug("unsubscribed from '%s'", channel);
            this.emit('redis:unsubscribed', channel);
        });

        subscriptionClient.on('message', (channel, message) => {
            debug("trigger received: '%s'", message);
            super.trigger(message);
        });

        subscriptionClient.on('ready', () => {
            debug("redis - subscription connection ready, subscribing to '%s'", this.topic);
            subscriptionClient.subscribe(this.topic);
            this.emit('redis:subscribe', this.topic);
        });

        subscriptionClient.on('error', (err) => {
            debug("error in subscription connection:", err);
            this.emit('redis:error', err);
        });

        const commandClient = this.commandClient = redis.createClient(service.port, service.host);
        commandClient.on('ready', () => {
            debug("redis - command connection ready");
            this.emit('redis:ready');
        });

        commandClient.on('error', (err) => {
            debug("error in command connection", err);
            this.emit('redis:error', err);
        });
    }

    async destroy() {
        debug("destroying redis registry");
        this.commandClient.end(true);
        this.subscriptionClient.end(true);
    }


    async trigger(url) {
        if (!this.commandClient) return;

        debug("Invalidating %s", url)
        await this.__invalidate(url);

        debug("Publishing '%s' to '%s'", url, this.topic);
        this.commandClient.publish(this.topic, url);
    }
}

exports.RedisRegistry = RedisRegistry;