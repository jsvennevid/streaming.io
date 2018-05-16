const debug = require('debug')('streaming.io:registry:base');
const crypto = require('crypto');
const { compress } = require('../compress');

class Subscription {
    constructor() {
        this.clients = new Map();
    }

    add(key, sid) {
        const kc = (() => {
            const kc = this.clients.get(key);
            if (kc) return kc;
            const value = new Set();
            this.clients.set(key, value);
            return value;
        })();
        kc.add(sid);
    }

    remove(key, sid) {
        const kc = this.clients.get(key);
        if (!kc) return;
        kc.delete(sid);
        if (!kc.size) {
            this.clients.delete(key);
        }
        return !this.clients.size;
    }

    has(key, sid) {
        const kc = this.clients.get(key);
        if (!kc) return false;
        return kc.has(sid);
    }

    keys() {
        return this.clients.keys();
    }
}

class Client {
    constructor() {
        this.subscriptions = new Map();
        this.cache = new Map();
    }

    get address() {
        throw new Error("Not implemented")
    }

    get session() {
        throw new Error("Not implemented")
    }

    async send(message) {
        throw new Error("Not implemented")
    }
}

class Registry {
    constructor() {
        this.subscriptions = new Map();
        this.clients = new Map();
    }

    async create(options) {
        this.options = options || {};

        this.__read = this.options.read || (async (url, key, session, info) => { throw new Error("No reader defined") });
        this.__invalidate = this.options.invalidate || (async () => {});
    }

    async destroy() {}

    async addClient(id, client) {
        debug("Adding client %s", id);

        if (this.clients.get(id)) {
            throw new Error("Client " + id + " already registered");
        }

        this.clients.set(id, client);
    }

    async removeClient(id) {
        debug("Removing client %s", id);

        const client = this.clients.get(id);
        if (!client) return;

        for (const kv of client.subscriptions) {
            const subscription = this.subscriptions.get(kv[0]);
            if (!subscription) {
                continue;
            }

            if (subscription.remove(kv[1], id)) {
                this.subscriptions.delete(kv[0]);
            }
        }

        this.clients.delete(id);
    }

    async addSubscription(id, url, remoteDigest, key, response) {
        debug("Subscribing to '%s' (socket: %s)", url, id);

        const client = this.clients.get(id);
        if (!client) {
            throw new Error("Client not found");
        }

        if (client.subscriptions.has(url)) {
            throw new Error("Already subscribed");
        }

        const subscription = (() => {
            const subscription = this.subscriptions.get(url);
            if (subscription) return subscription;

            const value = new Subscription();
            this.subscriptions.set(url, value);
            return value;
        })();

        if (subscription.has(id, key)) {
            throw new Error("Already subscribed to URL");
        }

        subscription.add(key, id);
        client.subscriptions.set(url, key);

        const message = {
            url: url
        };

        if (response) {
            const hash = crypto.createHash('sha1');
            hash.update(JSON.stringify(response));
            const digest = hash.digest().toString('base64');

            message.hash = digest;

            if (!remoteDigest || (digest !== remoteDigest)) {
                message.data = compress(response);
            }

            client.cache.set(url, digest);
        }

        return message;
    }

    async removeSubscription(id, url) {
        debug("Unsubscribe from '%s' (socket %s)", url, id);

        const client = this.clients.get(id);
        if (!client) {
            return;
        }

        do {
            if (!client.subscriptions.has(url)) {
                break;
            }

            const key = client.subscriptions.get(url);

            client.subscriptions.delete(url);
            client.cache.delete(url);

            const subscription = this.subscriptions.get(url);
            if (!subscription) {
                break;
            }

            if (subscription.remove(key, id)) {
                this.subscriptions.delete(url);
            }
        } while (false);
    }

    async trigger(url) {
        const subscription = this.subscriptions.get(url);
        if (!subscription) return;

        for (const key of subscription.keys()) {
            if (key) {
                await this.cachedTrigger(url, key);
            } else {
                await this.uncachedTrigger(url, key);
            }
        }
    }

    async cachedTrigger(url, key) {
        const data = await this.__read(url, key, undefined, undefined);

        const hash = crypto.createHash('sha1');
        hash.update(JSON.stringify(data));
        const digest = hash.digest().toString('base64');

        const message = {
            url: url,
            data: compress(data),
            hash: hash
        };

        for (const client of this.subscribers(url, key)) {
            if (digest === client.cache.get(url)) {
                return;
            }

            client.cache.set(url, digest);
            client.send(message);
        }
    }

    async uncachedTrigger(url) {
        for (const client of this.subscribers(url)) {
            const info = {
                address: client.address
            };

            const data = await this.__read(url, undefined, client.session, info);

            const hash = crypto.createHash('sha1');
            hash.update(JSON.stringify(data));
            const digest = hash.digest().toString('base64');

            if (digest === client.cache.get(url)) {
                return;
            }

            const message = {
                url: url,
                data: compress(data),
                hash: hash
            };

            client.cache.set(url, digest);
            client.send(message);
        }
    }

    *subscribers(url, key) {
        const subscription = this.subscriptions.get(url);
        if (!subscription) return;

        const clients = subscription.clients.get(key);

        for (const sid of clients) {
            yield this.clients.get(sid);
        }
    }
}

exports.Client = Client;
exports.Registry = Registry;
