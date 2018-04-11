const { RedisRegistry } = require('..');

const assert = require('assert');

// TODO: use an embedded redis

async function waitOnRegistry(registry, event) {
    let commandPromise, subscriptionPromise;

    switch (event) {
        case 'ready': {
            commandPromise = new Promise(resolve => {
                registry.commandClient.on(event, () => {
                    resolve();
                });
            });
            subscriptionPromise = new Promise(resolve => {
                registry.subscriptionClient.on(event, () => {
                    resolve();
                });
            });
        } break;
        case 'message': {
            commandPromise = Promise.resolve();
            subscriptionPromise = new Promise(resolve => {
                registry.subscriptionClient.on(event, () => {
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
    it('should trigger on several clients', async function () {
        let writes = 0, reads = 0, invalidates = 0;

        const options = {
            prefix: 'test-',
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

            read: async (url, key, session, info) => {
                reads ++;
                return { "data": "test" };
            }
        };

        const registry1 = new RedisRegistry();
        const registry2 = new RedisRegistry();

        const socket1 = { id: 'foo1', emit: () => { writes++; }, handshake: { address: "foo" }, request: { session: "foo" } };
        const socket2 = { id: 'foo2', emit: () => { writes++; }, handshake: { address: "foo" }, request: { session: "foo" } };
        const url = '/foo';

        await registry1.create(options);
        await registry2.create(options);

        await Promise.all([waitOnRegistry(registry1, 'ready'), waitOnRegistry(registry2, 'ready')]);

        await registry1.addSocket(socket1);
        await registry2.addSocket(socket2);
        await registry1.addSubscription(socket1, url, null, undefined, {});
        await registry2.addSubscription(socket2, url, null, undefined, {});

        await registry1.trigger(url);

        await Promise.all([waitOnRegistry(registry1, 'message'), waitOnRegistry(registry2, 'message')]);

        await registry1.destroy();
        await registry2.destroy();

        assert.equal(reads, 2, "Invalid number of reads");
        assert.equal(writes, 2, "Invalid number of writes");
        assert.equal(invalidates, 1, "Invalid number of invalidates");
    });
});
