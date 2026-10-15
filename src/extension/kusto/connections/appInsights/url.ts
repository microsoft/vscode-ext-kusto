const APP_INSIGHTS_ORIGIN = 'https://api.applicationinsights.io';

export function getAppInsightsApplicationUrl(appId: string): string {
    if (appId.trim().length === 0) {
        throw new Error('Application Insights application ID cannot be empty.');
    }
    return `${APP_INSIGHTS_ORIGIN}/v1/apps/${encodeURIComponent(appId)}`;
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

    return url.origin;
}
