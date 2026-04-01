import { Uri } from 'vscode';
import { DeepReadonly } from '../types';
import type { EngineSchema } from './schema';

export function getClusterDisplayName(clusterUri: string | EngineSchema | DeepReadonly<EngineSchema>) {
    let uri = '';
    if (typeof clusterUri === 'string') {
        uri = clusterUri;
    } else {
        uri = clusterUri.cluster.connectionString;
    }
    const parsed = Uri.parse(uri);
    // For Log Analytics ADE proxy URLs, extract the workspace name from the path.
    // e.g. https://ade.loganalytics.io/subscriptions/.../workspaces/{workspaceName}
    if (parsed.authority.toLowerCase().includes('loganalytics.io')) {
        const match = parsed.path.match(/\/workspaces\/([^/]+)/i);
        if (match) {
            return match[1];
        }
    }
    return parsed.authority.split('.')[0];
}
