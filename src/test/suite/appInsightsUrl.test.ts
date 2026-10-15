import * as assert from 'assert';

// eslint-disable-next-line @typescript-eslint/no-var-requires
const { getAppInsightsApplicationUrl, normalizeAppInsightsDataSource } = require('../../extension/index') as {
    getAppInsightsApplicationUrl(appId: string): string;
    normalizeAppInsightsDataSource(value: string): string;
};

suite('Application Insights URL validation', () => {
    test('constructs an encoded application URL', () => {
        assert.equal(
            getAppInsightsApplicationUrl('app/id?value'),
            'https://api.applicationinsights.io/v1/apps/app%2Fid%3Fvalue'
        );
    });

    test('accepts the supported application data source', () => {
        assert.equal(
            normalizeAppInsightsDataSource('https://api.applicationinsights.io/v1/apps/application-id'),
            'https://api.applicationinsights.io'
        );
    });

    const invalidUrls = [
        'http://api.applicationinsights.io/v1/apps/application-id',
        'https://attacker.example/v1/apps/application-id',
        'https://api.applicationinsights.io/v1/apps',
        'https://api.applicationinsights.io/v1/apps/application-id/query',
        'https://api.applicationinsights.io/v1/apps/application-id?query=value',
        'https://api.applicationinsights.io/v1/apps/application-id#fragment',
        'https://api.applicationinsights.io:8443/v1/apps/application-id'
    ];

    for (const value of invalidUrls) {
        test(`rejects ${value}`, () => {
            assert.throws(() => normalizeAppInsightsDataSource(value));
        });
    }
});
