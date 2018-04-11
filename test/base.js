const { BaseRegistry } = require('..');

const assert = require('assert');

describe('BaseRegistry', function () {
    it('should add subscription', async function () {
        const registry = new BaseRegistry();
        const socket = { id: 'foo' };
        const url = '/foo';

        await registry.create();

        await registry.addSocket(socket);
        await registry.addSubscription(socket, url, null, undefined, {});

        assert(registry.sockets.has(socket.id));
        assert(registry.subscriptions.has(url));
    });

    it('should remove subscription', async function () {
        const registry = new BaseRegistry();
        const socket = { id: 'foo' };
        const url1 = '/foo1';
        const url2 = '/foo2';

        await registry.create();

        await registry.addSocket(socket);
        await registry.addSubscription(socket, url1, null, undefined, {});
        await registry.addSubscription(socket, url2, null, undefined, {});

        await registry.removeSubscription(socket, url2);

        assert.deepEqual([url1], Array.from(registry.subscriptions.keys()), "Subscription keys are mismatching");
        assert.deepEqual([url1], Array.from(registry.sockets.get(socket.id).subscriptions.keys()), "Socket subscriptions are mismatching");
        assert.deepEqual([url1], Array.from(registry.sockets.get(socket.id).subscriptions.keys()), "Socket cache digests are mismatching");
    });

    it('should reject double subscriptions', async function () {
        const registry = new BaseRegistry();
        const socket = { id: 'foo' };
        const url = '/foo';

        await registry.create();

        await registry.addSocket(socket);
        await registry.addSubscription(socket, url, null, undefined, {});
        await registry.addSubscription(socket, url, null, undefined, {}).then(() => {
            throw new Error("This should not happen");
        }).catch((err) => {
            assert.equal("Already subscribed", err.message);
        });
    });

    it('should clear all subscriptions when removing socket', async function () {
        const registry = new BaseRegistry();
        const socket = { id: 'foo' };
        const url = '/foo';

        await registry.create();

        await registry.addSocket(socket);
        await registry.addSubscription(socket, url, null, undefined, {});

        await registry.removeSocket(socket);

        assert(!Array.from(registry.sockets.keys()).length);
        assert(!Array.from(registry.subscriptions.keys()).length);
    });

    it('should read only once per cached query', async function () {
        let writes = 0, reads = 0;

        const registry = new BaseRegistry();
        const socket1 = { id: 'foo1', emit: () => { writes++; } };
        const socket2 = { id: 'foo2', emit: () => { writes++; } };
        const url = '/foo';

        await registry.create({
            read: async (url, key, session, info) => {
                reads ++;
                return { "data": "test" };
            }
        });

        await registry.addSocket(socket1);
        await registry.addSocket(socket2);
        await registry.addSubscription(socket1, url, null, 'cache', {});
        await registry.addSubscription(socket2, url, null, 'cache', {});

        await registry.trigger(url);

        assert.equal(writes, 2);
        assert.equal(reads, 1);
    });

    it('should read once per client for a uncached query', async function () {
        let writes = 0, reads = 0;

        const registry = new BaseRegistry();
        const socket1 = { id: 'foo1', emit: () => { writes++; }, handshake: { address: "foo" }, request: { session: "foo" } };
        const socket2 = { id: 'foo2', emit: () => { writes++; }, handshake: { address: "foo" }, request: { session: "foo" } };
        const url = '/foo';

        await registry.create({
            read: async (url, key, session, info) => {
                reads ++;
                return { "data": "test" };
            }
        });

        await registry.addSocket(socket1);
        await registry.addSocket(socket2);
        await registry.addSubscription(socket1, url, null, undefined, {});
        await registry.addSubscription(socket2, url, null, undefined, {});

        await registry.trigger(url);

        assert.equal(writes, 2);
        assert.equal(reads, 2);
    });
});
