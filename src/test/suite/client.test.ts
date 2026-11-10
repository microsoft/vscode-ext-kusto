import * as assert from 'assert';

// eslint-disable-next-line @typescript-eslint/no-var-requires
const { evictCachedClientIfCurrent } = require('../../extension/index') as {
    evictCachedClientIfCurrent<TKey extends object, TValue>(
        cache: WeakMap<TKey, Promise<TValue | undefined>>,
        key: TKey,
        failedClient: TValue
    ): Promise<void>;
};

suite('Kusto client cache', () => {
    test('does not evict a replacement client after stale initialization fails', async () => {
        const cache = new WeakMap<object, Promise<object | undefined>>();
        const document = {};
        const failedClient = {};
        const replacementClient = {};
        let resolveFailedClient: (client: object) => void = () => undefined;
        const failedClientPromise = new Promise<object>((resolve) => {
            resolveFailedClient = resolve;
        });
        const replacementPromise = Promise.resolve(replacementClient);
        cache.set(document, failedClientPromise);

        const eviction = evictCachedClientIfCurrent(cache, document, failedClient);
        cache.set(document, replacementPromise);
        resolveFailedClient(failedClient);
        await eviction;

        assert.strictEqual(cache.get(document), replacementPromise);
    });

    test('evicts the failed client when it is still current', async () => {
        const cache = new WeakMap<object, Promise<object | undefined>>();
        const document = {};
        const failedClient = {};
        cache.set(document, Promise.resolve(failedClient));

        await evictCachedClientIfCurrent(cache, document, failedClient);

        assert.equal(cache.has(document), false);
    });
});
