import * as assert from 'assert';
import * as os from 'os';
import * as path from 'path';
import * as vscode from 'vscode';

suite('Kusto notebook connection security', () => {
    const invalidConnections: unknown[] = [
        { cluster: 'https://attacker.example', database: 'Samples' },
        'not a connection',
        42,
        true,
        [],
        {},
        { appInsightsId: 'missing-saved-connection' },
        { cluster: null, database: 'Samples' },
        { cluster: 'https://help.kusto.windows.net', database: 42 }
    ];

    invalidConnections.forEach((connection, index) => {
        test(`preserves cells when connection metadata is rejected: ${JSON.stringify(connection)}`, async () => {
            const uri = vscode.Uri.file(path.join(os.tmpdir(), `kusto-invalid-connection-${Date.now()}-${index}.knb`));
            const notebook = {
                cells: [
                    {
                        kind: 'code',
                        source: 'StormEvents | take 10',
                        outputs: []
                    }
                ],
                metadata: {
                    connection
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

    test('preserves supported connection metadata and cells', async () => {
        const uri = vscode.Uri.file(path.join(os.tmpdir(), `kusto-valid-connection-${Date.now()}.knb`));
        const notebook = {
            cells: [{ kind: 'code', source: 'StormEvents | take 10', outputs: [] }],
            metadata: { connection: { cluster: 'HTTPS://HELP.KUSTO.WINDOWS.NET/', database: '' } }
        };
        await vscode.workspace.fs.writeFile(uri, Buffer.from(JSON.stringify(notebook)));
        try {
            const document = await vscode.workspace.openNotebookDocument(uri);
            assert.equal(document.cellCount, 1);
            assert.equal(document.cellAt(0).document.getText(), 'StormEvents | take 10');
            assert.equal(document.metadata.connection.cluster, 'https://help.kusto.windows.net');
            assert.equal(document.metadata.connection.database, '');
            assert.equal(document.metadata.connection.type, 'azAuth');
        } finally {
            await vscode.workspace.fs.delete(uri);
        }
    });
});
