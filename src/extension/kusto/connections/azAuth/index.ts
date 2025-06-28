import { KustoConnectionStringBuilder } from 'azure-kusto-data';
import { authentication, env, Uri, window } from 'vscode';
import { EngineSchema } from '../../schema';
import { getClusterDisplayName } from '../../utils';
import { BaseConnection } from '../baseConnection';
import { updateConnectionCache } from '../storage';
import { AzureAuthenticatedConnectionInfo, IKustoClient, NewableKustoClient } from '../types';
import { getClusterSchema } from './schema';
import { LoggerFactory } from '../../../output/logger';

export class AzureAuthenticatedConnection extends BaseConnection<AzureAuthenticatedConnectionInfo> {
    private static KustoClientCtor: NewableKustoClient;
    private Logger = LoggerFactory.getLogger('kusto-ext');
    constructor(info: AzureAuthenticatedConnectionInfo) {
        super('azAuth', info);
    }
    public static registerKustoClient(ctor: NewableKustoClient) {
        AzureAuthenticatedConnection.KustoClientCtor = ctor;
    }
    public static connectionInfofrom(info: { cluster: string; database?: string }): AzureAuthenticatedConnectionInfo {
        return {
            cluster: info.cluster,
            database: info.database,
            displayName: getClusterDisplayName(info.cluster),
            id: info.cluster,
            type: 'azAuth'
        };
    }
    public static from(info: { cluster: string; database?: string }) {
        return new AzureAuthenticatedConnection(AzureAuthenticatedConnection.connectionInfofrom(info));
    }
    public async delete() {
        await updateConnectionCache({ info: this.info, action: 'remove' });
    }
    public async save() {
        await updateConnectionCache({ info: this.info, action: 'add' });
    }
    public getSchemaInternal(): Promise<EngineSchema> {
        return getClusterSchema(this.info);
    }
    public async getKustoClient(): Promise<IKustoClient> {
        if (!this.info.cluster) {
            this.Logger.error('Cluster information is missing in connection info.');
            throw new Error('Cluster information is missing in connection info.');
        }
        // Create and show output channel
        this.Logger.log(`Creating Kusto client for cluster: ${this.info.cluster}`);
        const accessToken = await this.getAccessToken();
        // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
        this.Logger.log(
            `Using access token for cluster: ${this.info.cluster} with token: ${
                accessToken ? 'provided' : 'not provided'
            }`
        );
        const connection = this.getConnectionBuilder(this.info.cluster, accessToken);
        return new AzureAuthenticatedConnection.KustoClientCtor(connection);
    }
    private getConnectionBuilder(cluster: string, accessToken?: string) {
        if (accessToken) {
            return KustoConnectionStringBuilder.withAccessToken(cluster, accessToken);
        }
        return KustoConnectionStringBuilder.withAadDeviceAuthentication(cluster, 'common', async (tokenResponse) => {
            const option = await window.showInformationMessage(
                tokenResponse.message,
                'Copy token to clipboard and open browser'
            );

            if (option) {
                await env.clipboard.writeText(tokenResponse.userCode);
                env.openExternal(Uri.parse(tokenResponse.verificationUri));
            }
        });
    }
    private async getAccessToken() {
        try {
            // Try Azure CLI first
            this.Logger.log('Attempting to get access token using Azure CLI');
            const token = await this.getAzureCliToken();
            if (token) {
                return token;
            }
        } catch (error) {
            // If CLI fails, fallback to interactive auth
            this.Logger.error('Azure CLI auth failed, falling back to interactive:', error as Error);
        }

        const scopes = ['https://management.core.windows.net/.default', 'offline_access'];

        const session = await authentication.getSession('microsoft', scopes, { createIfNone: true });
        if (session?.accessToken) {
            return session.accessToken;
        }
        return window.showInputBox({
            ignoreFocusOut: true,
            placeHolder: '',
            prompt: 'Enter Access Token'
        });
    }

    private async getAzureCliToken(): Promise<string | undefined> {
        this.Logger.log('Getting access token using AzureCliCredential');

        try {
            const credential = new AzureCliCredential();
            const token = await credential.getToken('https://management.core.windows.net/.default');
            if (token && token.token) {
                return token.token;
            } else {
                window.showErrorMessage('Failed to get access token from Azure CLI.');
                return undefined;
            }
        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : String(error);
            if (errorMessage.toLowerCase().includes('not logged in')) {
                window.showErrorMessage('Please run "az login" in your terminal to authenticate');
            } else {
                window.showErrorMessage(`Failed to get token: ${errorMessage}`);
            }
            this.Logger.error('Error getting Azure CLI token:', error as Error);
            throw error;
        }
    }
}
