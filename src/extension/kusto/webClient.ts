import {
    KustoConnectionStringBuilder,
    ClientRequestProperties,
    KustoResponseDataSet
} from 'azure-kusto-data';
// eslint-disable-next-line @typescript-eslint/no-var-requires
const azurePackage = require('../../../node_modules/azure-kusto-data/package.json');
import { IKustoClient } from './connections/types';
import axios from 'axios';
import * as uuid from 'uuid';

/* eslint-disable @typescript-eslint/no-explicit-any */

const COMMAND_TIMEOUT_IN_MILLISECS = 10.5 * 60 * 1000; // 10.5 minutes in milliseconds
const QUERY_TIMEOUT_IN_MILLISECS = 4.5 * 60 * 1000; // 4.5 minutes in milliseconds
const CLIENT_SERVER_DELTA_IN_MILLISECS = 0.5 * 60 * 1000; // 0.5 minutes in milliseconds
const MGMT_PREFIX = '.';

enum ExecutionType {
    Mgmt = 'mgmt',
    Query = 'query',
    Ingest = 'ingest',
    QueryV1 = 'queryv1'
}

export class KustoClient implements IKustoClient {
    private readonly connectionString: KustoConnectionStringBuilder;
    private readonly cluster?: string;
    public readonly headers: Record<string, string> = {};
    public readonly endpoints: Record<string, string> = {};
    constructor(kcsb: string | KustoConnectionStringBuilder) {
        this.connectionString = typeof kcsb === 'string' ? new KustoConnectionStringBuilder(kcsb) : kcsb;
        this.cluster = this.connectionString.dataSource;
        this.endpoints = {
            [ExecutionType.Mgmt]: `${this.cluster}/v1/rest/mgmt`,
            [ExecutionType.Query]: `${this.cluster}/v2/rest/query`,
            [ExecutionType.Ingest]: `${this.cluster}/v1/rest/ingest`,
            [ExecutionType.QueryV1]: `${this.cluster}/v1/rest/query`
        };
        this.headers = {
            Accept: 'application/json',
            'Accept-Encoding': 'gzip,deflate',
            'x-ms-client-version': `Kusto.Node.Client:${azurePackage.version}`
        };
    }
    public async executeQueryV1(db: string, query: string, properties?: ClientRequestProperties) {
        return this._execute(this.endpoints[ExecutionType.QueryV1], ExecutionType.QueryV1, db, query, null, properties);
    }

    public async execute(
        db: string,
        query: string,
        properties?: ClientRequestProperties
    ): Promise<KustoResponseDataSet> {
        query = query.trim();
        if (query.startsWith(MGMT_PREFIX)) {
            return this.executeMgmt(db, query, properties);
        }

        return this.executeQuery(db, query, properties);
    }
    async executeMgmt(db: string, query: string, properties?: ClientRequestProperties) {
        return this._execute(this.endpoints[ExecutionType.Mgmt], ExecutionType.Mgmt, db, query, null, properties);
    }
    async executeQuery(db: string, query: string, properties?: ClientRequestProperties) {
        return this._execute(this.endpoints[ExecutionType.Query], ExecutionType.Query, db, query, null, properties);
    }
    async _execute(
        endpoint: string,
        executionType: ExecutionType,
        db: string,
        query: string | null,
        stream: string | null,
        properties?: ClientRequestProperties | null
    ): Promise<KustoResponseDataSet> {
        // Merge instance headers (like x-api-key for App Insights) with request-specific headers
        const headers: { [header: string]: string } = { ...this.headers };

        let payload: { db: string; csl: string; properties?: any };
        let clientRequestPrefix = '';
        let clientRequestId;

        const timeout = this._getClientTimeout(executionType, properties);
        let payloadStr = '';
        if (query != null) {
            payload = {
                db: db,
                csl: query
            };

            if (properties != null) {
                payload.properties = properties.toJson();
                clientRequestId = properties.clientRequestId;

                // if (properties.application != null) {
                //     headers['x-ms-app'] = properties.application;
                // }

                // if (properties.user != null) {
                //     headers['x-ms-user'] = properties.user;
                // }
            }

            payloadStr = JSON.stringify(payload);

            headers['Content-Type'] = 'application/json; charset=utf-8';
            clientRequestPrefix = 'KNC.execute;';
        } else if (stream != null) {
            payloadStr = stream;
            clientRequestPrefix = 'KNC.executeStreamingIngest;';
            headers['Content-Encoding'] = 'gzip';
            headers['Content-Type'] = 'multipart/form-data';
        }

        headers['x-ms-client-request-id'] = clientRequestId || clientRequestPrefix + `${uuid.v4()}`;

        // headers.Authorization = await this.aadHelper._getAuthHeader();
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const { accessToken } = this.connectionString as any;
        headers.Authorization = `Bearer ${accessToken}`;

        return this._doRequest(endpoint, executionType, headers, payloadStr, timeout, properties);
    }

    async _doRequest(
        endpoint: string,
        executionType: ExecutionType,
        headers: { [header: string]: string },
        payload: string,
        timeout: number,
        properties?: ClientRequestProperties | null
    ): Promise<KustoResponseDataSet> {
        const axiosConfig = {
            headers,
            timeout
        };

        let axiosResponse;
        try {
            axiosResponse = await axios.post(endpoint, payload, axiosConfig);
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
        } catch (error: any) {
            if (error && error.response?.data?.error) {
                throw error.response.data.error;
            }
            if (error && error.response?.data?.Message) {
                throw error.response.data.Message;
            }
            throw error;
        }

        return this._parseResponse(axiosResponse.data, executionType, properties, axiosResponse.status);
    }

    _parseResponse(
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        response: any,
        executionType: ExecutionType,
        properties?: ClientRequestProperties | null,
        status?: number
    ): KustoResponseDataSet {
        const { raw } = properties || {};
        if (raw === true || executionType == ExecutionType.Ingest) {
            return response;
        }

        // For Application Insights API responses, create a simple wrapper
        // that provides the KustoResponseDataSet interface
        try {
            // Application Insights returns { tables: [...] } format
            const tables = response.tables || response.Tables || [];
            console.log('[webClient] Raw response tables:', JSON.stringify(tables.length > 0 ? {
                tableCount: tables.length,
                firstTableColumns: tables[0]?.columns || tables[0]?.Columns,
                firstTableRowCount: (tables[0]?.rows || tables[0]?.Rows)?.length
            } : 'no tables', null, 2));

            const primaryResults = tables.map((table: any) => {
                const rawColumns = table.columns || table.Columns || [];
                console.log('[webClient] Raw columns sample:', JSON.stringify(rawColumns.slice(0, 3)));

                const columns = rawColumns.map((col: any, index: number) => ({
                    name: col.name || col.ColumnName || col.columnName || `Column${index}`,
                    type: col.type || col.ColumnType || col.DataType || col.columnType || 'string',
                    ordinal: index
                }));

                console.log('[webClient] Parsed columns:', JSON.stringify(columns.slice(0, 3)));

                const rawRows = table.rows || table.Rows || [];
                console.log('[webClient] Row count:', rawRows.length, 'First row sample:', JSON.stringify(rawRows[0]));

                // Convert rows to data format expected by renderer (array of objects)
                // IMPORTANT: Convert undefined values to null to preserve them during JSON serialization
                // (JSON.stringify omits undefined values, which causes columns to disappear)
                const data = rawRows.map((row: any, rowIdx: number) => {
                    if (Array.isArray(row)) {
                        // Convert array row to object using column names
                        const rowObj: any = {};
                        columns.forEach((col: any, idx: number) => {
                            // Use null instead of undefined to preserve the property during JSON serialization
                            rowObj[col.name] = row[idx] !== undefined ? row[idx] : null;
                        });
                        if (rowIdx === 0) {
                            console.log('[webClient] Converted first row:', JSON.stringify(rowObj));
                        }
                        return rowObj;
                    }
                    // For object rows, also ensure undefined values become null
                    // Try multiple possible property names since APIs may use different naming conventions
                    if (rowIdx === 0) {
                        console.log('[webClient] Row is already object:', JSON.stringify(row));
                    }
                    const normalizedRow: any = {};
                    const rawCols = table.columns || table.Columns || [];
                    columns.forEach((col: any, idx: number) => {
                        // Try to get value using various possible property names
                        const originalCol = rawCols[idx] || {};
                        const possibleKeys = [
                            col.name,
                            originalCol.name,
                            originalCol.ColumnName,
                            originalCol.columnName
                        ].filter(k => k !== undefined && k !== null);

                        let value = undefined;
                        for (const key of possibleKeys) {
                            if (row[key] !== undefined) {
                                value = row[key];
                                break;
                            }
                        }
                        normalizedRow[col.name] = value !== undefined ? value : null;
                    });
                    return normalizedRow;
                });

                return {
                    name: table.name || table.TableName || 'PrimaryResult',
                    columns: columns,
                    // data property for plain JSON path in renderer
                    data: data,
                    // _rows for statusbar row count
                    _rows: rawRows,
                    // rows() method for KustoResultTable compatibility
                    rows: function* () {
                        for (let i = 0; i < rawRows.length; i++) {
                            const raw = Array.isArray(rawRows[i]) ? rawRows[i] : columns.map((c: any) => rawRows[i][c.name]);
                            yield {
                                raw: raw,
                                toJSON: () => data[i]
                            };
                        }
                    }
                };
            });

            // Return a response object compatible with KustoResponseDataSet interface
            return {
                tables: primaryResults,
                tableNames: primaryResults.map((t: any) => t.name),
                primaryResults: primaryResults,
                getErrorsCount: () => ({ warnings: 0, errors: 0 }),
                getExceptions: () => [],
                getWarnings: () => []
            } as any;
        } catch (ex) {
            throw new Error(`Failed to parse response ({${status}}) with the following error [${ex}].`);
        }
    }

    _getClientTimeout(executionType: ExecutionType, properties?: ClientRequestProperties | null): number {
        if (properties != null) {
            const clientTimeout = properties.getClientTimeout();
            if (clientTimeout) {
                return clientTimeout;
            }

            const serverTimeout = properties.getTimeout();
            if (serverTimeout) {
                return serverTimeout + CLIENT_SERVER_DELTA_IN_MILLISECS;
            }
        }

        return executionType == ExecutionType.Query || executionType == ExecutionType.QueryV1
            ? QUERY_TIMEOUT_IN_MILLISECS
            : COMMAND_TIMEOUT_IN_MILLISECS;
    }
}
