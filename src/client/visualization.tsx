// This must be on top, do not change. Required by webpack.
// eslint-disable-next-line no-unused-vars
// declare let __webpack_public_path__: string;
// declare const scriptUrl: string;
// const getPublicPath = () => {
//     return new URL(scriptUrl.replace(/[^/]+$/, '')).toString();
// };

// // eslint-disable-next-line prefer-const
// __webpack_public_path__ = getPublicPath();
// This must be on top, do not change. Required by webpack.

import type { ActivationFunction, OutputItem } from 'vscode-notebook-renderer';
import type { KustoResponseDataSet } from 'azure-kusto-data';
import type * as PlotlyType from 'plotly.js';

/* eslint-disable @typescript-eslint/no-explicit-any */

// eslint-disable-next-line @typescript-eslint/no-var-requires, @typescript-eslint/no-var-requires
const Plotly: typeof PlotlyType = require('plotly.js/dist/plotly');
// const Plotly: typeof PlotlyType = require('plotly.js');

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

        element.style.backgroundColor = 'white';
        const ele = element.appendChild(document.createElement('div'));
        renderChart(value.json(), ele);
        element.appendChild(style);
    } catch (ex) {
        console.error(`Failed to render output ${value.text()}`, ex);
    }
}

function getChartType(
    results: KustoResponseDataSet
):
    | { type: 'pie'; title: string }
    | { type: 'time'; title: string }
    | { type: 'bar'; title: string; orientation: 'v' | 'h' }
    | undefined {
    if (results.tables.length === 0) {
        return;
    }
    const queryPropertiesTable = results.tables.find((item) => item.name === '@ExtendedProperties');
    if (!queryPropertiesTable) {
        return;
    }

    // Handle both KustoResultTable and plain JSON from notebook serialization
    let rows: any[];

    if (typeof (queryPropertiesTable as any).rows === 'function') {
        // KustoResultTable - rows are arrays
        rows = Array.from((queryPropertiesTable as any).rows()).map((row: any) => row.raw);
    } else {
        // Plain JSON - check if data contains objects or arrays
        const data = (queryPropertiesTable as any).data || [];

        if (data.length > 0 && !Array.isArray(data[0])) {
            // Data is array of objects - just use the object values in key order
            rows = data.map((obj: any) => Object.values(obj));
        } else {
            // Data is already array of arrays
            rows = data;
        }
    }

    if (rows.length === 0) {
        return;
    }
    /**
    [1, "Visualization", "{"Visualization":"piechart","Title":null,"XColumn"…"]
    */
    if (
        rows[0][1] !== 'Visualization' &&
        // This is how we get Visualization for AppInsights.
        (typeof rows[0][0] !== 'string' || !rows[0][0].includes('Visualization'))
    ) {
        return;
    }
    let data: { Visualization: string; Title: string } | undefined;
    try {
        data = JSON.parse(rows[0][2]);
    } catch {
        //
    }
    try {
        data = data || JSON.parse(rows[0][0]);
    } catch {
        //
    }
    if (!data) {
        return;
    }
    try {
        if (data.Visualization === 'piechart') {
            return { type: 'pie', title: data.Title || '' };
        }
        if (data.Visualization === 'barchart') {
            return { type: 'bar', title: data.Title || '', orientation: 'h' };
        }
        if (data.Visualization === 'timechart' || data.Visualization === 'linechart') {
            return { type: 'time', title: data.Title || '' };
        }
        if (data.Visualization === 'columnchart') {
            return { type: 'bar', title: data.Title || '', orientation: 'v' };
        }
    } catch {
        return;
    }
}
function renderChart(results: KustoResponseDataSet, ele: HTMLElement) {
    const chartType = getChartType(results);
    if (!chartType) {
        console.error('Not a pie chart');
        return;
    }
    const layout = {
        title: chartType.title,
        autosize: true
    };
    // Ensures the chart is resized when the window is resized.
    let previousWidth = window.innerWidth;
    window.addEventListener('resize', () => {
        if (window.innerWidth !== previousWidth) {
            previousWidth = window.innerWidth;
            Plotly.Plots.resize(ele);
        }
    });

    // Handle both KustoResultTable and plain JSON from notebook serialization
    const primaryResult = results.primaryResults[0];
    const columns =
        typeof (primaryResult as any).rows === 'function'
            ? (primaryResult as any).columns
            : (primaryResult as any).columns || [];

    let rows: any[];
    if (typeof (primaryResult as any).rows === 'function') {
        // KustoResultTable - rows are arrays
        rows = Array.from((primaryResult as any).rows()).map((row: any) => row.raw);
    } else {
        // Plain JSON - check if data contains objects or arrays
        const data = (primaryResult as any).data || [];
        if (data.length > 0 && !Array.isArray(data[0])) {
            // Data is array of objects like [{CommandType: "Query", Count: 1}]
            // Convert objects to arrays - use Object.values since columns might be empty
            rows = data.map((obj: any) => Object.values(obj));
        } else {
            // Data is already array of arrays
            rows = data;
        }
    }

    if (chartType.type === 'pie') {
        // Determine values column index
        let valuesColumnIndex: number;
        if (columns.length > 0) {
            // If we have column metadata, try to find the 'long' column
            const clonedColumns = columns.slice();
            valuesColumnIndex =
                clonedColumns.reverse().find((item: any) => item.type === 'long')?.ordinal || clonedColumns.length - 1;
        } else {
            // No column metadata - assume last column (index 1 for 2-column data)
            valuesColumnIndex = rows.length > 0 && rows[0].length > 1 ? rows[0].length - 1 : 1;
        }

        const pieData: Partial<Plotly.PieData> = {
            type: chartType.type,
            textinfo: 'label+value',
            hoverinfo: 'all',
            labels: rows.map((item) => item[0]),
            values: rows.map((item) => item[valuesColumnIndex])
        } as any;

        // if we have more than 2 columns in the pie chart, we can turn it into a sunburst.
        if (columns.length > 2) {
            const ele1 = ele.appendChild(document.createElement('div'));
            ele1.style.display = 'inline-block';
            const ele2 = ele.appendChild(document.createElement('div'));
            ele2.style.display = 'inline-block';
            Plotly.newPlot(ele1, [pieData], layout);
            generateSunburstChart(ele2, results, layout);
        } else {
            Plotly.newPlot(ele, [pieData], layout);
        }
    }
    if (chartType.type === 'time') {
        const sortedData = rows.slice();
        const dateColumnIndex = columns.find((col: any) => col.type === 'datetime')?.ordinal || 0;
        const timeColumnIndex = columns.find((col: any) => col.type === 'timespan')?.ordinal || 0;
        // In case we have something that represents an hour.
        const hourColumnIndex = columns.find((col: any) => col.type === 'real')?.ordinal || 0;
        if (dateColumnIndex >= 0) {
            sortedData.sort((a, b) => new Date(a[dateColumnIndex]).getTime() - new Date(b[dateColumnIndex]).getTime());
        }
        if (timeColumnIndex >= 0) {
            sortedData.sort(
                (a, b) =>
                    new Date(`0001-01-01T${a[dateColumnIndex]}`).getTime() -
                    new Date(`0001-01-01T${b[dateColumnIndex]}`).getTime()
            );
        }
        if (hourColumnIndex >= 0) {
            sortedData.sort((a, b) => a[dateColumnIndex] - b[dateColumnIndex]);
        }
        if (timeColumnIndex === -1 && dateColumnIndex === -1) {
            console.error(`No datetime nor timespan column ${columns.map((col: any) => col.type)}`);
            return;
        }
        // Do we have multiple time series?
        if (columns.length > 2) {
            const seriesValues = new Map<string, { x: any[]; y: any[] }>();
            const columnIndexWithSeriesName = columns.find((col: any) => col.type === 'string')?.ordinal || 1;
            const lastColumn = columns[columns.length - 1];
            const columnIndexWithValue =
                lastColumn.type === 'long'
                    ? lastColumn.ordinal
                    : columns.find(
                          (col: any) =>
                              col.type !== 'string' &&
                              col.type !== 'datetime' &&
                              col.type !== 'timespan' &&
                              col.type !== 'real'
                      )?.ordinal || 2;
            const dateHourOrTimeColumnIndex =
                dateColumnIndex >= 0 ? dateColumnIndex : hourColumnIndex >= 0 ? hourColumnIndex : timeColumnIndex;
            sortedData.forEach((row) => {
                const seriesName = row[columnIndexWithSeriesName];
                const datetime = row[dateHourOrTimeColumnIndex];
                const value = row[columnIndexWithValue];
                const series = seriesValues.get(seriesName) || { x: [], y: [] };
                series.x.push(datetime);
                series.y.push(value);
                seriesValues.set(seriesName, series);
            });
            const plotData: Partial<Plotly.ScatterData>[] = [];
            seriesValues.forEach((values, series) => {
                const scatterData: Partial<Plotly.ScatterData> = {
                    type: 'scatter',
                    name: series,
                    x: values.x,
                    y: values.y
                } as any;
                plotData.push(scatterData);
            });
            Plotly.newPlot(ele, plotData, layout);
        } else {
            const scatterData: Partial<Plotly.ScatterData> = {
                type: 'scatter',
                x: sortedData.map((item) => item[0]),
                y: sortedData.map((item) => item[1])
            } as any;
            Plotly.newPlot(ele, [scatterData], layout);
        }
    }
    if (chartType.type === 'bar') {
        const labels = rows.map((item) => item[0]);
        const values = rows.map((item) => item[1]);
        const barData: Partial<Plotly.PlotData> = {
            type: chartType.type,
            orientation: chartType.orientation,
            textinfo: 'label+value',
            hoverinfo: 'all',
            x: chartType.orientation === 'v' ? labels : values,
            y: chartType.orientation === 'v' ? values : labels
        } as any;
        Plotly.newPlot(ele, [barData], layout);
    }
}

function generateSunburstChart(ele: HTMLElement, results: KustoResponseDataSet, layout: any) {
    const primaryResult = results.primaryResults[0];
    const columns =
        typeof (primaryResult as any).rows === 'function'
            ? (primaryResult as any).columns
            : (primaryResult as any).columns || [];

    let rows: any[];
    if (typeof (primaryResult as any).rows === 'function') {
        // KustoResultTable - rows are arrays
        rows = Array.from((primaryResult as any).rows()).map((row: any) => row.raw);
    } else {
        // Plain JSON - check if data contains objects or arrays
        const data = (primaryResult as any).data || [];
        if (data.length > 0 && !Array.isArray(data[0])) {
            // Data is array of objects - convert to arrays based on column order
            rows = data.map((obj: any) => columns.map((col: any) => obj[col.name]));
        } else {
            // Data is already array of arrays
            rows = data;
        }
    }

    if (columns.length <= 2) {
        return;
    }
    const valueColumnIndex = columns.length - 1;
    const ids: string[] = [];
    const labels: string[] = [];
    const parents: string[] = [];
    const values: number[] = [];

    // Construct hierarchial data.
    columns.forEach((col: any, index: number) => {
        if (valueColumnIndex === index) {
            return;
        }
        if (index === 0) {
            const labelsAndValues = new Map<string, number>();
            rows.forEach((row: any) => {
                const label = row[index].toString();
                labelsAndValues.set(label, (labelsAndValues.get(label) ?? 0) + row[valueColumnIndex]);
                console.info('1');
            });

            labelsAndValues.forEach((value, label) => {
                ids.push(label);
                labels.push(label);
                parents.push('');
                values.push(value);
            });
        } else {
            const labelsAndValues = new Map<string, { parentLabel: string; value: number; label: string }>();
            rows.forEach((row: any) => {
                const parentLabel = Array(index)
                    .fill(0)
                    .map((_, i) => row[i].toString())
                    .join('-');
                const label = row[index].toString();
                const value = row[valueColumnIndex];
                const id = `${parentLabel}-${label}`;
                if (labelsAndValues.has(id)) {
                    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
                    labelsAndValues.get(id)!.value += value;
                } else {
                    labelsAndValues.set(id, { value, label, parentLabel });
                }
            });
            labelsAndValues.forEach((item, id) => {
                ids.push(id);
                labels.push(item.label);
                parents.push(item.parentLabel);
                values.push(item.value);
            });
        }
    });
    const pieData: Partial<Plotly.PieData> = {
        type: 'sunburst',
        // textinfo: 'label+value',
        // hoverinfo: 'all',
        ids,
        labels,
        values,
        parents,
        hoverinfo: 'label+value+percent entry',
        branchvalues: 'total'
    } as any;
    Plotly.newPlot(ele, [pieData], layout);
}
