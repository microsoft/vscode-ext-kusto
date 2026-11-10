import * as assert from 'assert';

// eslint-disable-next-line @typescript-eslint/no-var-requires
const { getSupportedLegacyConnections } = require('../../extension/index') as {
    getSupportedLegacyConnections(
        clusters: string[]
    ): { cluster: string; id: string; type: 'azAuth'; displayName: string }[];
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
            connections.map((connection) => connection.cluster),
            supportedClusters
        );
    });

    test('returns an empty list when no legacy connections are supported', () => {
        assert.deepStrictEqual(getSupportedLegacyConnections(unsupportedClusters), []);
    });

    test('skips credential-bearing URLs without blocking supported connections', () => {
        const url = new URL(supportedClusters[0]);
        url.username = 'migration-log-test-user';
        url.password = 'migration-log-test-password';
        const connections = getSupportedLegacyConnections([supportedClusters[0], url.toString(), supportedClusters[1]]);
        assert.deepStrictEqual(
            connections.map((connection) => connection.cluster),
            supportedClusters
        );
    });

    test('preserves supported connections', () => {
        assert.deepStrictEqual(
            getSupportedLegacyConnections(supportedClusters).map((connection) => connection.cluster),
            supportedClusters
        );
    });

    test('accepts an empty legacy connection list', () => {
        assert.deepStrictEqual(getSupportedLegacyConnections([]), []);
    });

    test('produces plain connection records that survive persistence', () => {
        const connections = getSupportedLegacyConnections(['HTTPS://HELP.KUSTO.WINDOWS.NET/']);
        assert.deepStrictEqual(JSON.parse(JSON.stringify(connections)), [
            {
                cluster: 'https://help.kusto.windows.net',
                displayName: 'help',
                id: 'https://help.kusto.windows.net',
                type: 'azAuth'
            }
        ]);
    });
});
