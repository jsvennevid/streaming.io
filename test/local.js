const { LocalRegistry, Client } = require('..');

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

describe('LocalRegistry', function () {
    it('should invalidate url before resolving trigger', async function () {
        let writes = 0, reads = 0, invalidates = 0;

        const registry = new LocalRegistry();
        const id1 = 'foo1';
        const id2 = 'foo2';
        const url = '/foo';

        await registry.create({
            invalidate: async (url) => {
                invalidates ++;
            },

            read: async (url, key, info) => {
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
        assert.equal(invalidates, 1);
    });
});
