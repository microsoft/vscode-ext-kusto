import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { downloadAndUnzipVSCode } from '@vscode/test-electron';

async function main(): Promise<void> {
    const version = process.env.VSCODE_VERSION;
    if (!version || version === 'stable') {
        throw new Error('VSCODE_VERSION must be pinned to a specific version.');
    }

    const githubOutput = process.env.GITHUB_OUTPUT;
    if (!githubOutput) {
        throw new Error('GITHUB_OUTPUT is required to publish the VS Code executable path.');
    }

    const workspaceRoot = path.resolve(__dirname, '../../..');
    const vscodeExecutablePath = await downloadAndUnzipVSCode({
        version,
        cachePath: path.join(workspaceRoot, 'test-resources')
    });

    fs.appendFileSync(githubOutput, `path=${vscodeExecutablePath}${os.EOL}`);
    console.log(`VS Code ${version} is ready at ${vscodeExecutablePath}`);
}

main().catch((error) => {
    console.error('Failed to prepare VS Code', error);
    process.exit(1);
});
