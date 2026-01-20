/* eslint-disable @typescript-eslint/no-unused-vars */
/* eslint-disable no-unused-vars */
// This must be on top, do not change. Required by webpack.
// eslint-disable-next-line no-unused-vars
// declare let __webpack_public_path__: string;
// declare const scriptUrl: string;
// const getPublicPath = () => {
//     return new URL(scriptUrl.replace(/[^/]+$/, '')).toString();
// };

// eslint-disable-next-line prefer-const
// __webpack_public_path__ = getPublicPath();
// This must be on top, do not change. Required by webpack.

/* eslint-disable @typescript-eslint/no-explicit-any */

import * as React from 'react';
import * as ReactDOM from 'react-dom';
import type { ActivationFunction, OutputItem } from 'vscode-notebook-renderer';
import type { KustoResponseDataSet, KustoResultTable } from 'azure-kusto-data';
import { hasDataTable } from './utils';
import ReactJson from 'react-json-view';
import { AgGridReact } from 'ag-grid-react';
import { ModuleRegistry, AllCommunityModule } from 'ag-grid-community';

import 'ag-grid-community/styles/ag-grid.css';
import 'ag-grid-community/styles/ag-theme-balham.css';
import { CellDoubleClickedEvent, ColDef, RowSelectedEvent } from 'ag-grid-community';

// Register AG Grid modules
ModuleRegistry.registerModules([AllCommunityModule]);

export const activate: ActivationFunction = () => {
    return {
        renderOutputItem(outputItem, element) {
            renderOutput(outputItem, element);
        }
    };
};

/**
 * Called from renderer to render output.
 * This will be exposed as a public method on window for renderer to render output.
 */
function renderOutput(value: OutputItem, element: HTMLElement) {
    try {
        const style = document.createElement('style');
        style.type = 'text/css';
        style.media = 'screen';
        style.textContent = `
            .ag-cell,
            .ag-header-cell,
            .ag-header-container,
            .ag-header-viewport {
                overflow-x: hidden !important;
            }
        `;

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        renderDataTable(value.json(), element);
        element.appendChild(style);
    } catch (ex) {
        console.error(`Failed to render output ${value.text()}`, ex);
    }
}
const columnDataType = new Map<string, string>();
function createAgGridData(resultTable: KustoResultTable | any) {
    const gridData = {
        columnDefs: [] as ColDef[],
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        rowData: [] as { [idx: string]: any }[]
    };
    columnDataType.clear();

    // Handle both KustoResultTable object and plain JSON from serialization
    // After JSON serialization, the rows() generator function is lost, so we need to check
    // if rows is actually a function. If not, use the data array directly.
    const hasRowsMethod = typeof resultTable.rows === 'function';

    // Check for data in multiple possible locations (data, _rows, or raw array format)
    const dataArray = resultTable.data || resultTable._rows || [];
    const hasDataArray = Array.isArray(dataArray) && dataArray.length > 0;
    const isPlainJson = !hasRowsMethod && hasDataArray;

    console.log('[datatable] createAgGridData - hasRowsMethod:', hasRowsMethod);
    console.log('[datatable] createAgGridData - hasDataArray:', hasDataArray, 'length:', dataArray.length);
    console.log('[datatable] createAgGridData - isPlainJson:', isPlainJson);
    console.log('[datatable] createAgGridData - resultTable keys:', Object.keys(resultTable || {}));

    if (isPlainJson) {
        // Plain JSON structure from serialized response
        const columns = resultTable.columns || [];
        console.log('[datatable] Plain JSON path - columns count:', columns.length);
        console.log('[datatable] Plain JSON path - first data item:', JSON.stringify(dataArray[0]).substring(0, 200));

        // Check if rows are arrays (need conversion) or objects (ready to use)
        const firstRow = dataArray[0];
        const rowsAreArrays = Array.isArray(firstRow);
        console.log('[datatable] Plain JSON path - rows are arrays:', rowsAreArrays);

        // Build column definitions
        if (columns.length > 0) {
            // Use explicit columns from the response (preferred - preserves order and handles null values)
            for (const col of columns) {
                const colName = col.name || col.ColumnName || '';
                const colType = col.type || col.ColumnType || 'string';
                const columnDef: ColDef = {
                    headerName: colName,
                    field: colName,
                    sortable: true,
                    filter: true
                };

                // Handle dynamic type columns
                if (colType === 'dynamic') {
                    // Use IIFE to capture colName correctly in closure
                    const capturedColName = colName;
                    columnDef.valueGetter = (param) => {
                        const cellData = param.data?.[capturedColName];
                        return typeof cellData === 'string' ? cellData : JSON.stringify(cellData);
                    };
                }
                columnDataType.set(colName, colType);
                gridData.columnDefs.push(columnDef);
            }
        } else if (!rowsAreArrays && firstRow) {
            // Fallback: Infer columns from first row (may miss columns with null values)
            const columnNames = Object.keys(firstRow);
            console.log('[datatable] Inferring columns from first row:', columnNames.slice(0, 5));

            for (const colName of columnNames) {
                const columnDef: ColDef = {
                    headerName: colName,
                    field: colName,
                    sortable: true,
                    filter: true
                };

                // Check if value is an object (dynamic type)
                const sampleValue = firstRow[colName];
                if (sampleValue !== null && typeof sampleValue === 'object') {
                    const capturedColName = colName;
                    columnDef.valueGetter = (param) => {
                        const cellData = param.data?.[capturedColName];
                        return typeof cellData === 'string' ? cellData : JSON.stringify(cellData);
                    };
                    columnDataType.set(colName, 'dynamic');
                } else {
                    columnDataType.set(colName, typeof sampleValue);
                }

                gridData.columnDefs.push(columnDef);
            }
        }

        // Convert row data if needed
        if (rowsAreArrays && columns.length > 0) {
            // Convert array rows to objects using column names
            console.log('[datatable] Converting array rows to objects');
            gridData.rowData = dataArray.map((row: any[]) => {
                const rowObj: { [key: string]: any } = {};
                columns.forEach((col: any, idx: number) => {
                    const colName = col.name || col.ColumnName || `Column${idx}`;
                    rowObj[colName] = row[idx] !== undefined ? row[idx] : null;
                });
                return rowObj;
            });
        } else if (!rowsAreArrays) {
            // Rows are already objects - use directly
            console.log('[datatable] Using object rows directly');
            gridData.rowData = dataArray;
        } else {
            console.warn('[datatable] Array rows but no columns - cannot convert');
        }

        console.log('[datatable] Final rowData count:', gridData.rowData.length);
        console.log('[datatable] Final rowData[0]:', JSON.stringify(gridData.rowData[0] || {}).substring(0, 200));
    } else {
        // Proper KustoResultTable object with columns and rows() method
        const columns = resultTable.columns;
        for (const col of columns) {
            const columnDef: ColDef = {
                headerName: col.name || '',
                field: col.name || '',
                sortable: true,
                filter: true
            };

            if (col.type === 'dynamic' && col.name) {
                columnDef.valueGetter = (param) => {
                    const cellData = param.data[col.name || ''];
                    return typeof cellData === 'string' ? cellData : JSON.stringify(cellData);
                };
            }
            gridData.columnDefs.push(columnDef);
            columnDataType.set(col.name || '', col.type || '');
        }

        for (const row of resultTable.rows()) {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const rowDatum: { [idx: string]: any } = {};
            for (const col of columns) {
                const value = row.raw ? row.raw[col.ordinal] : row.toJSON()[col.name || ''];
                rowDatum[col.name || ''] = value;
            }
            gridData.rowData.push(rowDatum);
        }
    }
    return gridData;
}
function renderDataTable(results: KustoResponseDataSet, ele: HTMLElement) {
    console.log('[datatable] renderDataTable called with:', results);
    console.log('[datatable] results keys:', Object.keys(results || {}));
    console.log('[datatable] primaryResults length:', results?.primaryResults?.length);

    if (!hasDataTable(results)) {
        console.error('[datatable] No data table found in results');
        return;
    }
    const primaryResult = results.primaryResults[0];
    console.log('[datatable] primaryResult keys:', Object.keys(primaryResult || {}));
    console.log('[datatable] primaryResult.columns length:', primaryResult?.columns?.length);
    console.log('[datatable] primaryResult.data exists:', !!(primaryResult as any).data);
    console.log('[datatable] primaryResult.data length:', (primaryResult as any).data?.length);
    console.log('[datatable] primaryResult._rows exists:', !!(primaryResult as any)._rows);
    console.log('[datatable] primaryResult._rows length:', (primaryResult as any)._rows?.length);
    console.log('[datatable] primaryResult.rows is function:', typeof (primaryResult as any).rows === 'function');

    // Log first row from data or _rows
    const firstDataRow = (primaryResult as any).data?.[0];
    const firstRawRow = (primaryResult as any)._rows?.[0];
    console.log('[datatable] First data row sample:', JSON.stringify(firstDataRow)?.substring(0, 300));
    console.log('[datatable] First _rows sample:', JSON.stringify(firstRawRow)?.substring(0, 300));

    const data = createAgGridData(primaryResult);
    console.log('[datatable] AG Grid columnDefs count:', data.columnDefs.length);
    console.log('[datatable] AG Grid rowData count:', data.rowData.length);
    console.log('[datatable] AG Grid first columnDef:', JSON.stringify(data.columnDefs[0]));
    console.log('[datatable] AG Grid first rowData:', JSON.stringify(data.rowData[0])?.substring(0, 300));

    ReactDOM.render(React.createElement(DataTable, data, null), ele);
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function DataTable(props: { columnDefs: any; rowData: any }) {
    function onCellDoubleClicked(e: CellDoubleClickedEvent) {
        if (columnDataType.get(e.colDef.field || '') === 'dynamic' && e.colDef.field) {
            try {
                const json =
                    typeof e.data[e.colDef.field] === 'string'
                        ? JSON.parse(e.data[e.colDef.field])
                        : e.data[e.colDef.field];
                console.info(`Displaying details for ${e.colDef.field}`);
                setDetailsField(e.colDef.field);
                setDetailsJson(json);
                displayDetails(true);
            } catch (ex) {
                setDetailsJson(undefined);
                console.error(
                    `Failed to parse details into JSON for ${e.colDef.field} with data ${e.data[e.colDef.field]}`,
                    ex
                );
            }
        }
    }
    function onRowSelected(e: RowSelectedEvent) {
        if (!detailsVisible || !detailsField) {
            console.info(`Nothing to render`);
            return;
        }
        try {
            const json =
                typeof e.data[detailsField] === 'string' ? JSON.parse(e.data[detailsField]) : e.data[detailsField];
            console.info(`Displaying details for ${detailsField}`);
            setDetailsJson(json);
        } catch (ex) {
            setDetailsJson(undefined);
        }
    }
    const [detailsVisible, displayDetails] = React.useState<boolean>(false);
    const [detailsField, setDetailsField] = React.useState<string | undefined>(undefined);
    const [detailsJson, setDetailsJson] = React.useState<any>(undefined);
    return (
        <div className="ag-theme-balham" style={{ width: '100%', backgroundColor: 'white' }}>
            <AgGridReact
                domLayout="autoHeight"
                pagination={true}
                paginationPageSize={10}
                defaultColDef={{ resizable: true, filter: true, sortable: true, floatingFilter: true }}
                columnDefs={props.columnDefs}
                rowData={props.rowData}
                enableCellTextSelection={true}
                rowSelection="multiple"
                rowMultiSelectWithClick={false}
                onCellDoubleClicked={onCellDoubleClicked}
                onRowSelected={onRowSelected}
                suppressFieldDotNotation={true}
            ></AgGridReact>
            {detailsVisible && detailsJson && (
                <ReactJson src={detailsJson} displayDataTypes={false} displayObjectSize={false} />
            )}
        </div>
    );
}
