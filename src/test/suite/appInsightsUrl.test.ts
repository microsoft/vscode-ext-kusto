import * as assert from 'assert';

// eslint-disable-next-line @typescript-eslint/no-var-requires
const { getAppInsightsApplicationUrl, normalizeAppInsightsDataSource } = require('../../extension/index') as {
    getAppInsightsApplicationUrl(appId: string): string;
    normalizeAppInsightsDataSource(value: string): string;
};

suite('Application Insights URL validation', () => {
    const appId = '00000000-0000-4000-8000-000000000001';

    test('constructs an application URL for a valid GUID', () => {
        assert.equal(getAppInsightsApplicationUrl(` ${appId} `), `https://api.applicationinsights.io/v1/apps/${appId}`);
    });

    test('accepts the supported application data source', () => {
        assert.equal(
            normalizeAppInsightsDataSource(`https://api.applicationinsights.io/v1/apps/${appId}`),
            'https://api.applicationinsights.io'
        );
    });

    const invalidUrls = [
        `http://api.applicationinsights.io/v1/apps/${appId}`,
        `https://attacker.example/v1/apps/${appId}`,
        'https://api.applicationinsights.io/v1/apps',
        `https://api.applicationinsights.io/v1/apps/${appId}/query`,
        `https://api.applicationinsights.io/v1/apps/${appId}?query=value`,
        `https://api.applicationinsights.io/v1/apps/${appId}#fragment`,
        `https://api.applicationinsights.io:8443/v1/apps/${appId}`,
        'https://api.applicationinsights.io/v1/apps/not-a-guid'
    ];

    for (const value of invalidUrls) {
        test(`rejects ${value}`, () => {
            assert.throws(() => normalizeAppInsightsDataSource(value));
        });
    }

    for (const value of ['', 'not-a-guid', '00000000-0000-0000-0000-000000000000;data source=https://attacker']) {
        test(`rejects application ID ${value}`, () => {
            assert.throws(() => getAppInsightsApplicationUrl(value));
        });
    }
});
