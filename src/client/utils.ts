import { KustoResponseDataSet } from 'azure-kusto-data';

interface Schema {
    fields: Field[];
    primaryKey?: string[];
}
export interface Field {
    name: string;
    type: string;
}
export interface Datapoint {
    [fieldName: string]: any;
}
export interface TabularData {
    schema: Schema;
    data: Datapoint[];
}

export function hasDataTable(results: KustoResponseDataSet) {
    if (results.primaryResults.length === 0) {
        return false;
    }
    return true;
}
export function getTabularData(results: KustoResponseDataSet): TabularData | undefined {
    if (!hasDataTable(results)) {
        return;
    }
    const primaryTable = results.primaryResults[0] as any;
    const fields: Field[] = primaryTable.columns as any;
    const dataPoints: Datapoint[] = [];

    // Handle both KustoResultTable and plain JSON from notebook serialization
    if (typeof primaryTable.rows === 'function') {
        // KustoResultTable - use rows() generator
        for (const row of primaryTable.rows()) {
            const rowData: Datapoint = {};
            primaryTable.columns.forEach((col: any) => {
                if (col.name) {
                    const value = row.raw ? row.raw[col.ordinal] : row.toJSON()[col.name];
                    rowData[col.name] = value;
                }
            });
            dataPoints.push(rowData);
        }
    } else if (primaryTable.data) {
        // Plain JSON from serialization - use data array directly
        return {
            data: primaryTable.data,
            schema: {
                fields: fields
            }
        };
    }

    return {
        data: dataPoints,
        schema: {
            fields: fields
        }
    };
}
