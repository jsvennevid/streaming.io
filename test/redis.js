const { RedisRegistry, Client } = require('..');

const assert = require('assert');

// TODO: use an embedded redis

class TestClient extends Client {
    constructor(sender, ) {
        super();
        this.sender = sender;
    }

    get address() {
        return "127.0.0.1";
    }

    get session() {
        return "foo";
    }

    async send(message) {
        if (this.sender) {
            this.sender(message);
        }
    }
}

async function waitOnRegistry(registry, event) {
    let commandPromise, subscriptionPromise;

    switch (event) {
        case 'ready': {
            commandPromise = new Promise(resolve => {
                registry.once('redis:ready', () => {
                    resolve();
                });
            });
            subscriptionPromise = new Promise(resolve => {
                registry.once('redis:subscribed', () => {
                    resolve();
                });
            });
        } break;
        case 'message': {
            commandPromise = Promise.resolve();
            subscriptionPromise = new Promise(resolve => {
                registry.once('trigger', () => {
                    resolve();
                });
            });
        } break;
        default: {
            commandPromise = Promise.resolve();
            subscriptionPromise = Promise.resolve();
        }
    }

    await Promise.all([
        commandPromise, subscriptionPromise
    ]);
}

describe('RedisRegistry', function () {
    let registries = [];

    afterEach(async function () {
        for (let registry of registries) {
            await registry.destroy().catch(() => {});
        }
        registries = [];
    });

    it('should trigger on several clients', async function () {
        let writes = 0, reads = 0, invalidates = 0;

        const options = {
            prefix: 'test',
            host: 'localhost:6379',

            resolver: (host) => {
                return {
                    host: 'localhost',
                    port: 6379
                }
            },

            invalidate: async (url) => {
                invalidates ++;
            },

            read: async (url, key, info) => {
                reads ++;
                return { "data": "test" };
            }
        };

        const registry1 = new RedisRegistry();
        const registry2 = new RedisRegistry();

        registries.push(registry1, registry2);

        const id1 = 'foo1';
        const id2 = 'foo2';
        const url = '/foo';

        await registry1.create(options);
        await registry2.create(options);

        await Promise.all([waitOnRegistry(registry1, 'ready'), waitOnRegistry(registry2, 'ready')]);

        await registry1.add(id1, new TestClient(() => { writes++; }));
        await registry2.add(id2, new TestClient(() => { writes++; }));
        await registry1.subscribe(id1, url, null, undefined, {});
        await registry2.subscribe(id2, url, null, undefined, {});

        await registry1.trigger(url);

        await Promise.all([waitOnRegistry(registry1, 'message'), waitOnRegistry(registry2, 'message')]);

        assert.equal(reads, 2, "Invalid number of reads");
        assert.equal(writes, 2, "Invalid number of writes");
        assert.equal(invalidates, 1, "Invalid number of invalidates");
    });
});
