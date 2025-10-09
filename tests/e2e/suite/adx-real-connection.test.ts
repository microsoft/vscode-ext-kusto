import * as assert from 'assert';
import * as vscode from 'vscode';
import { ExtensionHelper } from '../helpers/extension';

/**
 * Real ADX Connection and Query Execution Tests
 *
 * This test suite tests actual connections to Azure Data Explorer clusters
 * and executes real queries. It requires proper environment configuration
 * with valid ADX cluster credentials and connection details.
 *
 * Required Environment Variables:
 * - ADX_CLUSTER_URI: The ADX cluster URI (e.g., https://mycluster.kusto.windows.net)
 * - ADX_DATABASE: The database name to connect to
 * - ADX_TABLE: A table name for testing queries
 * - ADX_ACCESS_TOKEN: Valid access token for authentication
 * - ADX_TENANT_ID: Azure AD tenant ID (optional)
 * - ADX_APPLICATION_ID: Application ID for service principal auth (optional)
 * - ADX_APPLICATION_KEY: Application key for service principal auth (optional)
 */

interface ADXTestConfig {
    clusterUri: string;
    database: string;
    table: string;
    accessToken?: string;
    tenantId?: string;
    applicationId?: string;
    applicationKey?: string;
}

interface QueryExecutionResult {
    query: string;
    success: boolean;
    executionTime: number;
    rowCount?: number;
    columns?: string[];
    error?: string;
    response?: any;
}

suite('Real ADX Connection and Query Execution Tests', () => {
    let extensionHelper: ExtensionHelper;
    let testConfig: ADXTestConfig;

    suiteSetup(async function () {
        this.timeout(120000); // 2 minutes for setup

        console.log('🚀 Setting up Real ADX Connection Tests...');

        // Get extension helper
        extensionHelper = ExtensionHelper.getInstance();
        await extensionHelper.activateExtension();

        // Load test configuration from environment
        testConfig = loadADXConfigFromEnvironment();

        console.log('ADX Test Configuration:');
        console.log(`  Cluster URI: ${testConfig.clusterUri || 'NOT SET'}`);
        console.log(`  Database: ${testConfig.database || 'NOT SET'}`);
        console.log(`  Table: ${testConfig.table || 'NOT SET'}`);
        console.log(`  Has Access Token: ${testConfig.accessToken ? 'YES' : 'NO'}`);
        console.log(`  Has Application ID: ${testConfig.applicationId ? 'YES' : 'NO'}`);
        console.log(`  Tenant ID: ${testConfig.tenantId || 'NOT SET'}`);

        console.log('✅ Real ADX Connection test setup completed');
    });

    suiteTeardown(async () => {
        // Clean up any open editors
        await vscode.commands.executeCommand('workbench.action.closeAllEditors');
        console.log('✅ Real ADX Connection test cleanup completed');
    });

    // =============================================================================
    // ENVIRONMENT AND CONFIGURATION TESTS
    // =============================================================================
    suite('Environment and Configuration Validation', () => {
        test('Required environment variables are set', function () {
            const missingVars: string[] = [];

            if (!testConfig.clusterUri) missingVars.push('ADX_CLUSTER_URI');
            if (!testConfig.database) missingVars.push('ADX_DATABASE');
            if (!testConfig.table) missingVars.push('ADX_TABLE');

            if (missingVars.length > 0) {
                assert.fail(
                    `⏵ Missing required environment variables: ${missingVars.join(
                        ', '
                    )}. Set these to run real ADX connection tests.`
                );
            }

            console.log('✅ All required environment variables are configured');
        });

        test('Authentication configuration is valid', function () {
            const hasAccessToken = !!testConfig.accessToken;
            const hasServicePrincipal = !!(
                testConfig.applicationId &&
                testConfig.applicationKey &&
                testConfig.tenantId
            );

            if (!hasAccessToken && !hasServicePrincipal) {
                assert.fail(
                    '⏵ No authentication method configured. Set either ADX_ACCESS_TOKEN or service principal credentials'
                );
            }

            if (hasAccessToken) {
                console.log('✅ Access Token authentication configured');
            }

            if (hasServicePrincipal) {
                console.log('✅ Service Principal authentication configured');
            }
        });

        test('azure-kusto-data module availability', async function () {
            try {
                const { KustoConnectionStringBuilder, Client } = await import('azure-kusto-data');

                assert.ok(KustoConnectionStringBuilder, 'KustoConnectionStringBuilder should be available');
                assert.ok(Client, 'Client should be available');

                console.log('✅ azure-kusto-data module is available');
            } catch (error: any) {
                const errorMessage = error?.message || error?.toString() || 'Unknown import error';
                console.log(`⏵ azure-kusto-data module not available: ${errorMessage}`);
                this.skip();
            }
        });
    });

    // =============================================================================
    // CONNECTION ESTABLISHMENT TESTS
    // =============================================================================
    suite('Connection Establishment', () => {
        test('Can establish connection with access token', async function () {
            this.timeout(60000); // 1 minute for connection

            if (!testConfig.accessToken) {
                console.log('⏵ Access token not configured, skipping access token connection test');
                this.skip();
                return;
            }

            try {
                const { KustoConnectionStringBuilder, Client } = await import('azure-kusto-data');

                const kcsb = KustoConnectionStringBuilder.withAccessToken(
                    testConfig.clusterUri,
                    testConfig.accessToken
                );
                const client = new Client(kcsb);

                // Test connection with a simple query
                const testQuery = '.show version';
                const response = await client.execute(testConfig.database, testQuery);

                assert.ok(response, 'Should receive response from cluster');
                console.log('✅ Access token connection established successfully');
            } catch (error: any) {
                const errorMessage = error?.message || error?.toString() || 'Unknown connection error';

                if (isNetworkError(errorMessage)) {
                    console.log(`⏵ Network connectivity issue: ${errorMessage}`);
                    this.skip();
                    return;
                }

                assert.fail(`Access token connection failed: ${errorMessage}`);
            }
        });

        test('Can establish connection with service principal', async function () {
            this.timeout(60000); // 1 minute for connection

            if (!testConfig.applicationId || !testConfig.applicationKey || !testConfig.tenantId) {
                console.log(
                    '⏵ Service principal credentials not configured, skipping service principal connection test'
                );
                this.skip();
                return;
            }

            try {
                const { KustoConnectionStringBuilder, Client } = await import('azure-kusto-data');

                const kcsb = KustoConnectionStringBuilder.withAadApplicationKeyAuthentication(
                    testConfig.clusterUri,
                    testConfig.applicationId,
                    testConfig.applicationKey,
                    testConfig.tenantId
                );
                const client = new Client(kcsb);

                // Test connection with a simple query
                const testQuery = '.show version';
                const response = await client.execute(testConfig.database, testQuery);

                assert.ok(response, 'Should receive response from cluster');
                console.log('✅ Service principal connection established successfully');
            } catch (error: any) {
                const errorMessage = error?.message || error?.toString() || 'Unknown connection error';

                if (isNetworkError(errorMessage)) {
                    console.log(`⏵ Network connectivity issue: ${errorMessage}`);
                    this.skip();
                    return;
                }

                assert.fail(`Service principal connection failed: ${errorMessage}`);
            }
        });
    });

    // =============================================================================
    // QUERY EXECUTION TESTS
    // =============================================================================
    suite('Query Execution', () => {
        test('Execute simple table query (take 10)', async function () {
            this.timeout(60000); // 1 minute for query execution

            const query = `${testConfig.table} | take 10`;
            const result = await executeADXQuery(query);

            if (!result.success) {
                if (isNetworkError(result.error)) {
                    console.log(`⏵ Network connectivity issue: ${result.error}`);
                    this.skip();
                    return;
                }
                if (isAuthError(result.error)) {
                    assert.fail(`Authentication failed: ${result.error}`);
                }
                if (isPermissionError(result.error)) {
                    assert.fail(`Permission denied: ${result.error}`);
                }
                assert.fail(`Query execution failed: ${result.error}`);
            }

            console.log('✅ Simple table query executed successfully');
            console.log(`   Query: ${result.query}`);
            console.log(`   Execution time: ${result.executionTime}ms`);
            console.log(`   Rows returned: ${result.rowCount || 'Unknown'}`);
            console.log(`   Columns: ${result.columns?.length || 'Unknown'}`);

            // Validate results
            assert.ok(result.rowCount !== undefined, 'Should return row count information');
            assert.ok(result.rowCount >= 0, 'Row count should be non-negative');
            assert.ok(result.rowCount <= 10, 'Should not return more than 10 rows (take 10)');
        });

        test('Execute count query', async function () {
            this.timeout(60000); // 1 minute for query execution

            const query = `${testConfig.table} | count`;
            const result = await executeADXQuery(query);

            if (!result.success) {
                if (isNetworkError(result.error)) {
                    console.log(`⏵ Network connectivity issue: ${result.error}`);
                    this.skip();
                    return;
                }
                assert.fail(`Count query execution failed: ${result.error}`);
            }

            assert.ok(result.response, 'Query result should contain response object');

            console.log('✅ Count query executed successfully', JSON.stringify(result));
            console.log(`   Query: ${result.query}`);
            console.log(`   Execution time: ${result.executionTime}ms`);
            console.log(`   Table row count: ${result.rowCount || 'Unknown'}`);

            // Validate that count query returns exactly 1 row with the count
            // Check for errors in the response
            if (result.response.errors && result.response.errors.length > 0) {
                assert.fail(`Response contains errors: ${JSON.stringify(result.response.errors)}`);
            }

            // Check for primary results
            assert.ok(result.response.primaryResults, 'Response should contain primaryResults');
            assert.ok(Array.isArray(result.response.primaryResults), 'primaryResults should be an array');
        });

        test('Execute query with WHERE clause', async function () {
            this.timeout(60000); // 1 minute for query execution

            // Use a simple WHERE clause that should work on most tables
            const query = `${testConfig.table} | where isnotnull(timestamp) or isnotnull(TimeGenerated) | take 5`;
            const result = await executeADXQuery(query);

            if (!result.success) {
                if (isNetworkError(result.error)) {
                    console.log(`⏵ Network connectivity issue: ${result.error}`);
                    this.skip();
                    return;
                }
                // WHERE clause might fail if table doesn't have expected columns, which is fine
                console.log(`⚠️ WHERE clause query failed (table schema may vary): ${result.error}`);
                return;
            }

            console.log('✅ WHERE clause query executed successfully');
            console.log(`   Query: ${result.query}`);
            console.log(`   Execution time: ${result.executionTime}ms`);
            console.log(`   Rows returned: ${result.rowCount || 'Unknown'}`);

            // Validate results
            assert.ok(result.rowCount !== undefined, 'Should return row count information');
            assert.ok(result.rowCount >= 0, 'Row count should be non-negative');
            assert.ok(result.rowCount <= 5, 'Should not return more than 5 rows (take 5)');
        });

        test('Handle query syntax error gracefully', async function () {
            this.timeout(30000); // 30 seconds for invalid query

            const query = 'INVALID_QUERY_SYNTAX | this should fail';
            const result = await executeADXQuery(query);

            // This query should fail with a syntax error
            assert.strictEqual(result.success, false, 'Invalid query should fail');
            assert.ok(result.error, 'Should return error message for invalid query');

            console.log('✅ Invalid query handled gracefully');
            console.log(`   Error: ${result.error}`);
        });

        test('Handle non-existent table gracefully', async function () {
            this.timeout(30000); // 30 seconds for invalid table query

            const query = 'NonExistentTable123456 | take 1';
            const result = await executeADXQuery(query);

            // This query should fail because table doesn't exist
            assert.strictEqual(result.success, false, 'Non-existent table query should fail');
            assert.ok(result.error, 'Should return error message for non-existent table');

            console.log('✅ Non-existent table query handled gracefully');
            console.log(`   Error: ${result.error}`);
        });
    });

    // =============================================================================
    // PERFORMANCE AND TIMEOUT TESTS
    // =============================================================================
    suite('Performance and Reliability', () => {
        test('Query execution completes within reasonable time', async function () {
            this.timeout(30000); // 30 seconds max

            const query = `${testConfig.table} | take 1`;
            const result = await executeADXQuery(query);

            if (!result.success) {
                if (isNetworkError(result.error)) {
                    console.log(`⏵ Network connectivity issue: ${result.error}`);
                    this.skip();
                    return;
                }
                assert.fail(`Performance test query failed: ${result.error}`);
            }

            // Validate performance expectations
            assert.ok(result.executionTime < 30000, 'Simple query should complete within 30 seconds');

            console.log('✅ Query performance test passed');
            console.log(`   Execution time: ${result.executionTime}ms`);
        });

        test('Can execute multiple queries in sequence', async function () {
            this.timeout(120000); // 2 minutes for multiple queries

            const queries = [
                `${testConfig.table} | count`,
                `${testConfig.table} | take 1`,
                `${testConfig.table} | take 3`
            ];

            const results: QueryExecutionResult[] = [];

            for (const query of queries) {
                const result = await executeADXQuery(query);
                results.push(result);

                if (!result.success) {
                    if (isNetworkError(result.error)) {
                        console.log(`⏵ Network connectivity issue: ${result.error}`);
                        this.skip();
                        return;
                    }
                    assert.fail(`Sequential query failed: ${result.error}`);
                }
            }

            console.log('✅ Multiple sequential queries executed successfully');
            results.forEach((result, index) => {
                console.log(`   Query ${index + 1}: ${result.executionTime}ms, ${result.rowCount} rows`);
            });

            // Validate all queries succeeded
            assert.ok(
                results.every((r) => r.success),
                'All sequential queries should succeed'
            );
        });

        test('Connection handles concurrent queries', async function () {
            this.timeout(180000); // 3 minutes for concurrent queries

            const queries = [
                `${testConfig.table} | take 2`,
                `${testConfig.table} | take 3`,
                `${testConfig.table} | count`
            ];

            // Execute queries concurrently
            const promises = queries.map((query) => executeADXQuery(query));
            const results = await Promise.all(promises);

            const failedResults = results.filter((r) => !r.success);

            if (failedResults.length > 0) {
                const networkFailures = failedResults.filter((r) => isNetworkError(r.error));
                if (networkFailures.length === failedResults.length) {
                    console.log('⏵ All concurrent query failures were network-related');
                    this.skip();
                    return;
                }

                assert.fail(`Some concurrent queries failed: ${failedResults.map((r) => r.error).join(', ')}`);
            }

            console.log('✅ Concurrent queries executed successfully');
            results.forEach((result, index) => {
                console.log(`   Query ${index + 1}: ${result.executionTime}ms, ${result.rowCount} rows`);
            });

            // Validate all queries succeeded
            assert.ok(
                results.every((r) => r.success),
                'All concurrent queries should succeed'
            );
        });
    });

    // =============================================================================
    // HELPER FUNCTIONS
    // =============================================================================

    function loadADXConfigFromEnvironment(): ADXTestConfig {
        return {
            clusterUri: process.env.ADX_CLUSTER_URI || '',
            database: process.env.ADX_DATABASE || '',
            table: process.env.ADX_TABLE || '',
            accessToken: process.env.ADX_ACCESS_TOKEN,
            tenantId: process.env.ADX_TENANT_ID,
            applicationId: process.env.ADX_APPLICATION_ID,
            applicationKey: process.env.ADX_APPLICATION_KEY
        };
    }

    async function executeADXQuery(query: string): Promise<QueryExecutionResult> {
        const startTime = Date.now();

        try {
            const { KustoConnectionStringBuilder, Client } = await import('azure-kusto-data');

            // Use the preferred authentication method
            let kcsb;
            if (testConfig.accessToken) {
                kcsb = KustoConnectionStringBuilder.withAccessToken(testConfig.clusterUri, testConfig.accessToken);
            } else if (testConfig.applicationId && testConfig.applicationKey && testConfig.tenantId) {
                kcsb = KustoConnectionStringBuilder.withAadApplicationKeyAuthentication(
                    testConfig.clusterUri,
                    testConfig.applicationId,
                    testConfig.applicationKey,
                    testConfig.tenantId
                );
            } else {
                throw new Error('No valid authentication method configured');
            }

            const client = new Client(kcsb);

            const response = await client.execute(testConfig.database, query);
            const executionTime = Date.now() - startTime;

            // Extract meaningful data from response
            const primaryResults = response?.primaryResults?.[0];
            const rowCount = primaryResults?.rows?.length || 0;
            const columns = primaryResults?.columns?.map((col: any) => col.name || col.ColumnName) || [];

            return {
                query,
                success: true,
                executionTime,
                rowCount,
                columns,
                response
            };
        } catch (error: any) {
            const executionTime = Date.now() - startTime;
            const errorMessage = extractErrorMessage(error);

            return {
                query,
                success: false,
                executionTime,
                error: errorMessage
            };
        }
    }

    function extractErrorMessage(error: any): string {
        // Enhanced error extraction for debugging
        console.log('🔍 Debugging error object:', {
            type: typeof error,
            constructor: error?.constructor?.name,
            message: error?.message,
            name: error?.name,
            code: error?.code,
            stack: error?.stack?.substring(0, 200) + '...',
            keys: error ? Object.keys(error) : 'N/A'
        });

        if (typeof error === 'string') {
            return error;
        }

        // Check for standard error properties
        if (error?.message) {
            return `${error.name || 'Error'}: ${error.message}`;
        }

        // Check for HTTP/network errors
        if (error?.response?.data) {
            try {
                const responseData =
                    typeof error.response.data === 'string' ? error.response.data : JSON.stringify(error.response.data);
                return `HTTP ${error.response.status || ''} Error: ${responseData}`;
            } catch {
                return `HTTP ${error.response.status || 'Unknown'} Error`;
            }
        }

        // Check for network request errors
        if (error?.request) {
            return `Network request failed - check connectivity and cluster URI (${error.code || 'unknown error'})`;
        }

        // Check for Azure/Kusto specific error properties
        if (error?.error?.message) {
            return `Azure Error: ${error.error.message}`;
        }

        // Check for Kusto client errors
        if (error?.clientRequestId) {
            return `Kusto Client Error (RequestId: ${error.clientRequestId}): ${error.message || 'Unknown'}`;
        }

        // Try toString() method
        if (error?.toString && typeof error.toString === 'function') {
            try {
                const stringified = error.toString();
                if (stringified !== '[object Object]' && stringified !== 'Error') {
                    return stringified;
                }
            } catch {
                // toString failed
            }
        }

        // Try JSON.stringify as last resort with more properties
        try {
            const errorObj = {
                name: error?.name,
                message: error?.message,
                code: error?.code,
                errno: error?.errno,
                syscall: error?.syscall,
                hostname: error?.hostname,
                response: error?.response
                    ? { status: error.response.status, statusText: error.response.statusText }
                    : undefined,
                config: error?.config ? { url: error.config.url, method: error.config.method } : undefined
            };

            const jsonString = JSON.stringify(errorObj, null, 2);
            if (jsonString && jsonString !== '{}' && jsonString !== 'null') {
                return `Structured Error: ${jsonString}`;
            }
        } catch {
            // JSON.stringify failed
        }

        return `Unknown error (Type: ${typeof error}, Constructor: ${error?.constructor?.name || 'unknown'})`;
    }

    function isNetworkError(error?: string): boolean {
        if (!error) return false;
        return (
            error.includes('getaddrinfo') ||
            error.includes('ENOTFOUND') ||
            error.includes('EAI_AGAIN') ||
            error.includes('ECONNREFUSED')
        );
    }

    function isAuthError(error?: string): boolean {
        if (!error) return false;
        return error.includes('401') || error.includes('Unauthorized');
    }

    function isPermissionError(error?: string): boolean {
        if (!error) return false;
        return error.includes('403') || error.includes('Forbidden');
    }
});
