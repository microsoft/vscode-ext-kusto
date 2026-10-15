import * as assert from 'assert';

// eslint-disable-next-line @typescript-eslint/no-var-requires
const { isValidKustoClusterUrl, normalizeKustoClusterUrl } = require('../../extension/index') as {
    isValidKustoClusterUrl(value: unknown): value is string;
    normalizeKustoClusterUrl(value: string): string;
};

suite('Kusto cluster URL validation', () => {
    const validUrls = [
        'https://help.kusto.windows.net',
        'https://cluster.region.kusto.windows.net',
        'https://cluster.region.privatelink.kusto.windows.net',
        'https://cluster.kusto.azuresynapse.net',
        'https://cluster.kusto.data.microsoft.com',
        'https://cluster.kusto.fabric.microsoft.com',
        'https://adx.monitor.azure.com',
        'https://user:password@help.kusto.windows.net',
        'https://help.kusto.windows.net:8443'
    ];

    for (const value of validUrls) {
        test(`accepts ${value}`, () => {
            assert.equal(isValidKustoClusterUrl(value), true);
        });
    }

    const invalidUrls = [
        'http://help.kusto.windows.net',
        'https://attacker.example',
        'https://kusto.windows.net.attacker.example',
        'https://localhost',
        'https://127.0.0.1',
        'https://[::1]',
        'https://169.254.169.254',
        'https://cluster.kusto.chinacloudapi.cn',
        'https://cluster.kusto.usgovcloudapi.net',
        'https://cluster.kusto.cloudapi.de',
        'https://help.kusto.windows.net/path',
        'https://help.kusto.windows.net?query=value',
        'https://help.kusto.windows.net#fragment',
        ' '
    ];

    for (const value of invalidUrls) {
        test(`rejects ${value}`, () => {
            assert.equal(isValidKustoClusterUrl(value), false);
            assert.throws(() => normalizeKustoClusterUrl(value));
        });
    }

    test('normalizes scheme, hostname, and trailing slash', () => {
        assert.equal(normalizeKustoClusterUrl('HTTPS://HELP.KUSTO.WINDOWS.NET/'), 'https://help.kusto.windows.net');
        assert.equal(
            normalizeKustoClusterUrl('https://user:password@help.kusto.windows.net'),
            'https://help.kusto.windows.net'
        );
        assert.equal(
            normalizeKustoClusterUrl('https://help.kusto.windows.net:8443'),
            'https://help.kusto.windows.net:8443'
        );
    });
});
