import { validate as isUuid } from 'uuid';

const APP_INSIGHTS_ORIGIN = 'https://api.applicationinsights.io';

export function getAppInsightsApplicationUrl(appId: string): string {
    const normalizedAppId = appId.trim();
    if (!isUuid(normalizedAppId)) {
        throw new Error('Application Insights application ID must be a valid GUID.');
    }
    return `${APP_INSIGHTS_ORIGIN}/v1/apps/${encodeURIComponent(normalizedAppId)}`;
}

export function normalizeAppInsightsDataSource(value: string): string {
    let url: URL;
    try {
        url = new URL(value.trim());
    } catch {
        throw new Error('Application Insights data source must be a valid URL.');
    }

    if (
        url.protocol !== 'https:' ||
        url.hostname.toLowerCase() !== 'api.applicationinsights.io' ||
        url.port ||
        url.username ||
        url.password ||
        url.search ||
        url.hash
    ) {
        throw new Error('Application Insights data source must use the supported HTTPS endpoint.');
    }

    const pathSegments = url.pathname.split('/').filter((part) => part.length > 0);
    if (pathSegments.length !== 3 || pathSegments[0] !== 'v1' || pathSegments[1] !== 'apps') {
        throw new Error('Application Insights data source must identify one application.');
    }
    try {
        if (!isUuid(decodeURIComponent(pathSegments[2]))) {
            throw new Error();
        }
    } catch {
        throw new Error('Application Insights data source must identify a valid application GUID.');
    }

    return url.origin;
}
