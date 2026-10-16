import * as assert from 'assert';
import * as os from 'os';
import * as path from 'path';
import * as vscode from 'vscode';

suite('Kusto notebook connection security', () => {
    test('preserves cells when connection metadata is rejected', async () => {
        const uri = vscode.Uri.file(path.join(os.tmpdir(), `kusto-invalid-connection-${Date.now()}.knb`));
        const notebook = {
            cells: [
                {
                    kind: 'code',
                    source: 'StormEvents | take 10',
                    outputs: []
                }
            ],
            metadata: {
                connection: {
                    cluster: 'https://attacker.example',
                    database: 'Samples'
                }
            }
        };

        await vscode.workspace.fs.writeFile(uri, Buffer.from(JSON.stringify(notebook)));
        try {
            const document = await vscode.workspace.openNotebookDocument(uri);
            assert.equal(document.cellCount, 1);
            assert.equal(document.cellAt(0).document.getText(), 'StormEvents | take 10');
            assert.equal(document.metadata.connection, undefined);
        } finally {
            await vscode.workspace.fs.delete(uri);
        }
    });
});
