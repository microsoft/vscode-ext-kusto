import * as assert from 'assert';

// eslint-disable-next-line @typescript-eslint/no-var-requires
const { getSupportedLegacyConnections } = require('../../extension/index') as {
    getSupportedLegacyConnections(clusters: string[]): { info: { cluster: string } }[];
};

suite('Legacy Kusto connection migration', () => {
    const supportedClusters = ['https://help.kusto.windows.net', 'https://cluster.region.kusto.windows.net'];
    const unsupportedClusters = ['https://localhost', 'https://cluster.kusto.usgovcloudapi.net'];

    test('keeps supported connections before and after unsupported entries', () => {
        const connections = getSupportedLegacyConnections([
            supportedClusters[0],
            ...unsupportedClusters,
            supportedClusters[1]
        ]);

        assert.deepStrictEqual(
            connections.map((connection) => connection.info.cluster),
            supportedClusters
        );
    });

    test('returns an empty list when no legacy connections are supported', () => {
        assert.deepStrictEqual(getSupportedLegacyConnections(unsupportedClusters), []);
    });

    test('preserves supported connections', () => {
        assert.deepStrictEqual(
            getSupportedLegacyConnections(supportedClusters).map((connection) => connection.info.cluster),
            supportedClusters
        );
    });

    test('accepts an empty legacy connection list', () => {
        assert.deepStrictEqual(getSupportedLegacyConnections([]), []);
    });
});
