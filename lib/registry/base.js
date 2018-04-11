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

class Socket {
    constructor(socket) {
        this.socket = socket;
        this.subscriptions = new Map();
        this.cache = new Map();
    }
}

class BaseRegistry {
    constructor() {
        this.subscriptions = new Map();
        this.sockets = new Map();
    }

    async create(options) {
        this.options = options || {};

        this.__read = this.options.read || (async (url, key, session, info) => { throw new Error("No reader defined") });
        this.__invalidate = this.options.invalidate || (async () => {});
    }

    async destroy() {}

    async addSocket(socket) {
        debug("Adding socket %s", socket.id);

        if (this.sockets.get(socket.id)) {
            throw new Error("Socket " + socket.id + " already registered");
        }

        this.sockets.set(socket.id, new Socket(socket));
    }

    async removeSocket(socket) {
        debug("Removing socket %s", socket.id);

        const data = this.sockets.get(socket.id);
        if (!data) return;

        for (const kv of data.subscriptions) {
            const subscription = this.subscriptions.get(kv[0]);
            if (!subscription) {
                continue;
            }

            if (subscription.remove(kv[1], socket.id)) {
                this.subscriptions.delete(kv[0]);
            }
        }

        this.sockets.delete(socket.id);
    }

    async addSubscription(socket, url, remoteDigest, key, response) {
        debug("Subscribing to '%s' (socket: %s)", url, socket.id);

        const data = this.sockets.get(socket.id);

        if (!data) {
            throw new Error("Socket not found");
        }

        if (data.subscriptions.has(url)) {
            throw new Error("Already subscribed");
        }

        const subscription = (() => {
            const subscription = this.subscriptions.get(url);
            if (subscription) return subscription;

            const value = new Subscription();
            this.subscriptions.set(url, value);
            return value;
        })();

        if (subscription.has(socket.id, key)) {
            throw new Error("Already subscribed to URL");
        }

        subscription.add(key, socket.id);
        data.subscriptions.set(url, key);

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

            data.cache.set(url, digest);
        }

        return message;
    }

    async removeSubscription(socket, url) {
        debug("Unsubscribe from '%s' (socket %s)", url, socket.id);

        const data = this.sockets.get(socket.id);
        if (!data) {
            return;
        }

        do {
            if (!data.subscriptions.has(url)) {
                break;
            }

            const key = data.subscriptions.get(url);

            data.subscriptions.delete(url);
            data.cache.delete(url);

            const subscription = this.subscriptions.get(url);
            if (!subscription) {
                break;
            }

            if (subscription.remove(key, socket.id)) {
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
            client.socket.emit('stream', message);
        }
    }

    async uncachedTrigger(url) {
        for (const client of this.subscribers(url)) {
            const socket = client.socket;
            const info = {
                address: socket.handshake.address
            };

            const data = await this.__read(url, undefined, socket.request.session, info);

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
            socket.emit('stream', message);
        }
    }

    *subscribers(url, key) {
        const subscription = this.subscriptions.get(url);
        if (!subscription) return;

        const clients = subscription.clients.get(key);

        for (const sid of clients) {
            yield this.sockets.get(sid);
        }
    }
}

exports.BaseRegistry = BaseRegistry;
