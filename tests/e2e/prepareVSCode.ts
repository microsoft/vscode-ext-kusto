import * as path from 'path';
import { downloadAndUnzipVSCode } from '@vscode/test-electron';

async function main(): Promise<void> {
    const version = process.env.VSCODE_VERSION;
    if (!version || version === 'stable') {
        throw new Error('VSCODE_VERSION must be pinned to a specific version.');
    }

    const workspaceRoot = path.resolve(__dirname, '../../..');
    const vscodeExecutablePath = await downloadAndUnzipVSCode({
        version,
        cachePath: path.join(workspaceRoot, 'test-resources')
    });

    console.log(`##vso[task.setvariable variable=VSCODE_EXECUTABLE_PATH]${vscodeExecutablePath}`);
    console.log(`VS Code ${version} is ready at ${vscodeExecutablePath}`);
}

main().catch((error) => {
    console.error('Failed to prepare VS Code', error);
    process.exit(1);
});
