import { kustoTrustedEndpoints } from 'azure-kusto-data';

const MICROSOFT_PUBLIC_CLOUD_LOGIN_ENDPOINT = 'https://login.microsoftonline.com';

export function normalizeKustoClusterUrl(value: string): string {
    let url: URL;
    try {
        url = new URL(value.trim());
    } catch {
        throw new Error('Kusto cluster URI must be a valid URL.');
    }

    if (url.protocol !== 'https:') {
        throw new Error('Kusto cluster URI must use HTTPS.');
    }
    if (url.pathname !== '/' || url.search || url.hash) {
        throw new Error('Kusto cluster URI cannot contain a path, query, or fragment.');
    }

    const hostname = url.hostname.toLowerCase();
    if (isLocalOrIpAddress(hostname)) {
        throw new Error('Kusto cluster URI cannot use a local or IP address.');
    }
    try {
        kustoTrustedEndpoints.validateTrustedEndpoint(url, MICROSOFT_PUBLIC_CLOUD_LOGIN_ENDPOINT);
    } catch {
        throw new Error('Kusto cluster URI must use a trusted Microsoft public-cloud Kusto hostname.');
    }

    return url.origin;
}

function isLocalOrIpAddress(hostname: string): boolean {
    if (hostname === 'localhost' || hostname.endsWith('.localhost')) {
        return true;
    }
    if (hostname.startsWith('[') && hostname.endsWith(']')) {
        return true;
    }

    const parts = hostname.split('.');
    return parts.length === 4 && parts.every((part) => /^\d{1,3}$/.test(part) && Number(part) <= 255);
}

export function isValidKustoClusterUrl(value: unknown): value is string {
    if (typeof value !== 'string' || value.trim().length === 0) {
        return false;
    }
    try {
        normalizeKustoClusterUrl(value);
        return true;
    } catch {
        return false;
    }
}
