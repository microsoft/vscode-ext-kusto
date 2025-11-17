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

import { CellDoubleClickedEvent, ColDef, RowSelectedEvent, themeQuartz } from 'ag-grid-community';
import { useMemo } from 'react'



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
    const isPlainJson = !resultTable.columns && resultTable.data;

    if (isPlainJson) {
        // Plain JSON structure from serialized response
        const rows = resultTable.data as any[];
        if (rows.length === 0) {
            return gridData;
        }

        // Infer columns from first row
        const firstRow = rows[0];
        const columnNames = Object.keys(firstRow);

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
                columnDef.valueGetter = (param) => {
                    const cellData = param.data[colName];
                    return typeof cellData === 'string' ? cellData : JSON.stringify(cellData);
                };
                columnDataType.set(colName, 'dynamic');
            } else {
                columnDataType.set(colName, typeof sampleValue);
            }

            gridData.columnDefs.push(columnDef);
        }

        // Rows are already in the correct format
        gridData.rowData = rows;
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
    console.log('renderDataTable', results);
    if (!hasDataTable(results)) {
        console.error('No data table');
        return;
    }
    const data = createAgGridData(results.primaryResults[0]);
    ReactDOM.render(React.createElement(DataTable, data, null), ele);
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function DataTable(props: { columnDefs: any; rowData: any }) {
    const rowSelection = useMemo(() => {
        return {
            mode: 'multiRow' as const,
            checkboxes: false,
            headerCheckbox: false,
            enableClickSelection: true,
            enableSelectionWithoutKeys: false,

        };
    }, []);
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
        } else {
            console.info(`Column ${e.data[e.colDef.field || '']} is not of dynamic type`);
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
    const [darkMode, setDarkMode] = React.useState<boolean>(false);

    const gridTheme = useMemo(() => {
        return darkMode ? themeQuartz.withParams({
            backgroundColor: '#1e1e1e',
            foregroundColor: '#e0e0e0',
            browserColorScheme: 'dark'
        }) : themeQuartz;
    }, [darkMode]);

    const processCellForClipboard = React.useCallback((params) => {
        return "C-" + params.value;
    }, []);

    return (
        <div style={{ width: '100%' }}>
            <div style={{ padding: '10px', display: 'flex', alignItems: 'center', gap: '10px' }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                    <input
                        type="checkbox"
                        checked={darkMode}
                        onChange={(e) => setDarkMode(e.target.checked)}
                    />
                    Dark Mode
                </label>
            </div>
            <div style={{ width: '100%' }}>
            <AgGridReact
                theme={gridTheme}
                domLayout="autoHeight"
                pagination={true}
                paginationPageSize={10}
                paginationPageSizeSelector={[10, 20, 50, 100]}
                processCellForClipboard={processCellForClipboard}
                defaultColDef={{ resizable: true, filter: true, sortable: true, floatingFilter: true }}
                columnDefs={props.columnDefs}
                rowData={props.rowData}
                enableCellTextSelection={true}
                ensureDomOrder={true}
                rowSelection={rowSelection}
                onCellDoubleClicked={onCellDoubleClicked}
                onRowSelected={onRowSelected}
                suppressFieldDotNotation={true}
            ></AgGridReact>
            {detailsVisible && detailsJson && (
                <ReactJson src={detailsJson} displayDataTypes={false} displayObjectSize={false} />
            )}
            </div>
        </div>
    );
}
