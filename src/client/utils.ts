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
    const primaryTable = results.primaryResults[0];
    const fields: Field[] = primaryTable.columns as any;
    const dataPoints: Datapoint[] = [];
    for (const row of primaryTable.rows()) {
        const rowData: Datapoint = {};
        primaryTable.columns.forEach((col) => {
            if (col.name) {
                const value = row.raw ? row.raw[col.ordinal] : row.toJSON()[col.name];
                rowData[col.name] = value;
            }
        });
        dataPoints.push(rowData);
    }
    return {
        data: dataPoints,
        schema: {
            fields: fields
        }
    };
}
