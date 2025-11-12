import type { KustoResponseDataSet } from 'azure-kusto-data';
import { NotebookCellOutput } from 'vscode';

export function getTableOutput(_results: KustoResponseDataSet): NotebookCellOutput | undefined {
    return;
}
