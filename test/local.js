const { LocalRegistry } = require('..');

const assert = require('assert');

describe('LocalRegistry', function () {
    it('should invalidate url before resolving trigger', async function () {
        let writes = 0, reads = 0, invalidates = 0;

        const registry = new LocalRegistry();
        const socket1 = { id: 'foo1', emit: () => { writes++; }, handshake: { address: "foo" }, request: { session: "foo" } };
        const socket2 = { id: 'foo2', emit: () => { writes++; }, handshake: { address: "foo" }, request: { session: "foo" } };
        const url = '/foo';

        await registry.create({
            invalidate: async (url) => {
                invalidates ++;
            },

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
        assert.equal(invalidates, 1);
    });
});
