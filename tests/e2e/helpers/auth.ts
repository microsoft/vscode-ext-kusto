import * as vscode from 'vscode';

/**
 * Authentication Helper for E2E Tests
 *
 * Provides utilities for handling Azure authentication in test environment.
 */

export interface TestAuthConfig {
    tenantId?: string;
    clientId?: string;
    clientSecret?: string;
    testClusterUri?: string;
    testDatabaseName?: string;
}

export class AuthHelper {
    private static instance: AuthHelper;
    private config: TestAuthConfig;

    private constructor() {
        this.config = this.loadTestConfig();
    }

    public static getInstance(): AuthHelper {
        if (!AuthHelper.instance) {
            AuthHelper.instance = new AuthHelper();
        }
        return AuthHelper.instance;
    }

    /**
     * Load test configuration from environment variables
     */
    private loadTestConfig(): TestAuthConfig {
        return {
            tenantId: process.env.AZURE_TENANT_ID,
            clientId: process.env.AZURE_CLIENT_ID,
            clientSecret: process.env.AZURE_CLIENT_SECRET,
            testClusterUri: process.env.KUSTO_TEST_CLUSTER || 'https://help.kusto.windows.net',
            testDatabaseName: process.env.KUSTO_TEST_DATABASE || 'Samples'
        };
    }

    /**
     * Check if Azure authentication is configured
     */
    public isAzureAuthConfigured(): boolean {
        return !!(this.config.tenantId && this.config.clientId && this.config.clientSecret);
    }

    /**
     * Check if test cluster is configured
     */
    public isTestClusterConfigured(): boolean {
        return !!(this.config.testClusterUri && this.config.testDatabaseName);
    }

    /**
     * Get test cluster URI
     */
    public getTestClusterUri(): string {
        return this.config.testClusterUri || 'https://help.kusto.windows.net';
    }

    /**
     * Get test database name
     */
    public getTestDatabaseName(): string {
        return this.config.testDatabaseName || 'Samples';
    }

    /**
     * Get authentication configuration for tests
     */
    public getAuthConfig(): TestAuthConfig {
        return { ...this.config };
    }

    /**
     * Mock Azure authentication session
     */
    public async mockAzureAuthSession(): Promise<vscode.AuthenticationSession> {
        const mockSession: vscode.AuthenticationSession = {
            id: 'test-session-id',
            accessToken: 'mock-access-token',
            account: {
                id: 'test-account-id',
                label: 'Test Account'
            },
            scopes: ['https://vault.azure.net/.default']
        };

        return mockSession;
    }

    /**
     * Setup test authentication environment
     */
    public async setupTestAuth(): Promise<void> {
        // Set environment variables for Azure authentication
        if (this.isAzureAuthConfigured()) {
            console.log('✅ Azure authentication is configured for E2E tests');
        } else {
            console.log('⚠️  Azure authentication not configured, using mock authentication');
        }
    }

    /**
     * Cleanup authentication after tests
     */
    public async cleanupAuth(): Promise<void> {
        // Clear any cached authentication state
        console.log('🧹 Cleaning up authentication state');
    }

    /**
     * Wait for authentication to complete
     */
    public async waitForAuth(timeoutMs = 30000): Promise<boolean> {
        const startTime = Date.now();

        while (Date.now() - startTime < timeoutMs) {
            // Check if authentication is ready
            if (this.isAzureAuthConfigured()) {
                return true;
            }

            // Wait a bit before checking again
            await new Promise((resolve) => setTimeout(resolve, 1000));
        }

        return false;
    }

    /**
     * Get authentication provider for testing
     */
    public getAuthProvider(): string {
        if (this.isAzureAuthConfigured()) {
            return 'azure';
        }
        return 'mock';
    }
}
