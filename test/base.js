const { Registry, Client } = require('..');

const assert = require('assert');

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

describe('BaseRegistry', function () {
    it('should add subscription', async function () {
        const registry = new Registry();
        const id = 'foo';
        const url = '/foo';

        await registry.create();

        await registry.add(id, new TestClient);
        await registry.subscribe(id, url, null, undefined, {});

        assert(registry.clients.has(id));
        assert(registry.subscriptions.has(url));
    });

    it('should remove subscription', async function () {
        const registry = new Registry();
        const id = 'foo';
        const url1 = '/foo1';
        const url2 = '/foo2';

        await registry.create();

        await registry.add(id, new TestClient);
        await registry.subscribe(id, url1, null, undefined, {});
        await registry.subscribe(id, url2, null, undefined, {});

        await registry.unsubscribe(id, url2);

        assert.deepEqual([url1], Array.from(registry.subscriptions.keys()), "Subscription keys are mismatching");
        assert.deepEqual([url1], Array.from(registry.clients.get(id).subscriptions.keys()), "Client subscriptions are mismatching");
        assert.deepEqual([url1], Array.from(registry.clients.get(id).subscriptions.keys()), "Client cache digests are mismatching");
    });

    it('should reject double subscriptions', async function () {
        const registry = new Registry();
        const id = 'foo';
        const url = '/foo';

        await registry.create();

        await registry.add(id, new TestClient);
        await registry.subscribe(id, url, null, undefined, {});
        await registry.subscribe(id, url, null, undefined, {}).then(() => {
            throw new Error("This should not happen");
        }).catch((err) => {
            assert.equal("Already subscribed", err.message);
        });
    });

    it('should clear all subscriptions when removing socket', async function () {
        const registry = new Registry();
        const id = 'foo';
        const url = '/foo';

        await registry.create();

        await registry.add(id, new TestClient);
        await registry.subscribe(id, url, null, undefined, {});

        await registry.remove(id);

        assert(!Array.from(registry.clients.keys()).length);
        assert(!Array.from(registry.subscriptions.keys()).length);
    });

    it('should read only once per cached query', async function () {
        let writes = 0, reads = 0;

        const registry = new Registry();
        const id1 = 'foo1';
        const id2 = 'foo2';
        const url = '/foo';

        await registry.create({
            read: async (url, key, session, info) => {
                reads ++;
                return { "data": "test" };
            }
        });

        await registry.add(id1, new TestClient(() => { writes++; }));
        await registry.add(id2, new TestClient(() => { writes++; }));
        await registry.subscribe(id1, url, null, 'cache', {});
        await registry.subscribe(id2, url, null, 'cache', {});

        await registry.trigger(url);

        assert.equal(writes, 2);
        assert.equal(reads, 1);
    });

    it('should read once per client for a uncached query', async function () {
        let writes = 0, reads = 0;

        const registry = new Registry();
        const id1 = 'foo1';
        const id2 = 'foo2';
        const url = '/foo';

        await registry.create({
            read: async (url, key, session, info) => {
                reads ++;
                return { "data": "test" };
            }
        });

        await registry.add(id1, new TestClient(() => { writes++; }));
        await registry.add(id2, new TestClient(() => { writes++; }));
        await registry.subscribe(id1, url, null, undefined, {});
        await registry.subscribe(id2, url, null, undefined, {});

        await registry.trigger(url);

        assert.equal(writes, 2);
        assert.equal(reads, 2);
    });
});
