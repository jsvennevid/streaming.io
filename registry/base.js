const debug = require('debug')('streaming.io:registry:base');
const { EventEmitter } = require('events');
const hash = require('object-hash');

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

class Registry extends EventEmitter {
    constructor() {
        super();
        this.subscriptions = new Map();
        this.clients = new Map();
    }

    async create(options) {
        this.options = options || {};

        this.__read = this.options.read || (async (url, key, session, info) => { throw new Error("No reader defined") });
        this.__invalidate = this.options.invalidate || (async () => {});
        this.__compress = this.options.compress || (data => data);
    }

    async destroy() {}

    async add(id, client) {
        debug("Adding client %s", id);

        if (this.clients.get(id)) {
            throw new Error("Client " + id + " already registered");
        }

        this.clients.set(id, client);
    }

    async remove(id) {
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

    async subscribe(id, url, remoteDigest, key, response) {
        debug("Subscribing to '%s' (client %s)", url, id);

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
            throw new Error("Already subscribed");
        }

        subscription.add(key, id);
        client.subscriptions.set(url, key);

        const message = {
            url: url
        };

        if (response) {
            const digest = hash(response, { encoding: 'base64' });
            message.hash = digest;

            if (!remoteDigest || (digest !== remoteDigest)) {
                message.data = this.__compress(response);
            }

            client.cache.set(url, digest);
        }

        return message;
    }

    async unsubscribe(id, url) {
        debug("Unsubscribe from '%s' (client %s)", url, id);

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
        this.emit('trigger', url);

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
        const digest = hash(data, { encoding: 'base64' });

        const message = {
            url: url,
            data: this.__compress(data),
            hash: digest
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
            const digest = hash(data, { encoding: 'base64' });

            if (digest === client.cache.get(url)) {
                return;
            }

            const message = {
                url: url,
                data: this.__compress(data),
                hash: digest
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
