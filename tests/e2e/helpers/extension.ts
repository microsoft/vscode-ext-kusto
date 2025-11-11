import * as vscode from 'vscode';

/**
 * Extension Helper for E2E Tests
 *
 * Provides utilities for interacting with the Kusto extension during tests.
 */

export class ExtensionHelper {
    private static instance: ExtensionHelper;
    private extension: vscode.Extension<any> | undefined;

    public static getInstance(): ExtensionHelper {
        if (!ExtensionHelper.instance) {
            ExtensionHelper.instance = new ExtensionHelper();
        }
        return ExtensionHelper.instance;
    }

    /**
     * Get the Kusto extension instance
     */
    public async getExtension(): Promise<vscode.Extension<any>> {
        if (!this.extension) {
            this.extension = vscode.extensions.getExtension('donjayamanne.kusto');

            if (!this.extension) {
                throw new Error('Kusto extension not found');
            }
        }

        return this.extension;
    }

    /**
     * Activate the extension
     */
    public async activateExtension(): Promise<void> {
        const extension = await this.getExtension();

        if (!extension.isActive) {
            console.log('🔌 Activating Kusto extension...');
            await extension.activate();
            console.log('✅ Extension activated');
        }
    }

    /**
     * Check if extension is active
     */
    public async isExtensionActive(): Promise<boolean> {
        try {
            const extension = await this.getExtension();
            return extension.isActive;
        } catch {
            return false;
        }
    }

    /**
     * Execute a command and wait for completion
     */
    public async executeCommand<T>(command: string, ...args: any[]): Promise<T> {
        console.log(`🎯 Executing command: ${command}`);
        return vscode.commands.executeCommand<T>(command, ...args);
    }

    /**
     * Wait for a command to be registered
     */
    public async waitForCommand(command: string, timeoutMs = 10000): Promise<boolean> {
        const startTime = Date.now();

        while (Date.now() - startTime < timeoutMs) {
            const commands = await vscode.commands.getCommands();
            if (commands.includes(command)) {
                return true;
            }

            await new Promise((resolve) => setTimeout(resolve, 500));
        }

        return false;
    }

    /**
     * Get all registered commands from the extension
     */
    public async getExtensionCommands(): Promise<string[]> {
        const allCommands = await vscode.commands.getCommands();
        return allCommands.filter((cmd) => cmd.startsWith('kusto.'));
    }

    /**
     * Open a file in VS Code
     */
    public async openFile(filePath: string): Promise<vscode.TextDocument> {
        const uri = vscode.Uri.file(filePath);
        return vscode.workspace.openTextDocument(uri);
    }

    /**
     * Create a new untitled document
     */
    public async createUntitledDocument(language?: string): Promise<vscode.TextDocument> {
        return vscode.workspace.openTextDocument({
            language: language || 'kusto',
            content: ''
        });
    }

    /**
     * Show a document in the editor
     */
    public async showDocument(document: vscode.TextDocument): Promise<vscode.TextEditor> {
        return vscode.window.showTextDocument(document);
    }

    /**
     * Get the active text editor
     */
    public getActiveEditor(): vscode.TextEditor | undefined {
        return vscode.window.activeTextEditor;
    }

    /**
     * Wait for a specific view to be visible
     */
    public async waitForView(viewId: string, timeoutMs = 10000): Promise<boolean> {
        const startTime = Date.now();

        while (Date.now() - startTime < timeoutMs) {
            // Check if view is visible
            // This is a simplified check - in real implementation,
            // you might need to check view state more thoroughly
            const treeView = vscode.window.createTreeView(viewId, {
                treeDataProvider: {
                    getTreeItem: () => null,
                    getChildren: () => []
                }
            });

            if (treeView.visible) {
                treeView.dispose();
                return true;
            }

            treeView.dispose();
            await new Promise((resolve) => setTimeout(resolve, 500));
        }

        return false;
    }

    /**
     * Get workspace configuration for the extension
     */
    public getConfiguration(section?: string): vscode.WorkspaceConfiguration {
        return vscode.workspace.getConfiguration(section || 'kusto');
    }

    /**
     * Update workspace configuration
     */
    public async updateConfiguration(section: string, value: any, global = false): Promise<void> {
        const config = this.getConfiguration();
        await config.update(section, value, global);
    }

    /**
     * Reset extension configuration to defaults
     */
    public async resetConfiguration(): Promise<void> {
        const config = this.getConfiguration();
        const keys = Object.keys(config);

        for (const key of keys) {
            await config.update(key, undefined, true);
        }
    }

    /**
     * Wait for extension to be ready
     */
    public async waitForExtensionReady(timeoutMs = 30000): Promise<boolean> {
        const startTime = Date.now();

        while (Date.now() - startTime < timeoutMs) {
            if (await this.isExtensionActive()) {
                // Check if essential commands are registered
                const commands = await this.getExtensionCommands();
                const essentialCommands = [
                    'kusto.createNotebook',
                    'kusto.executeSelectedQuery',
                    'kusto.changeDocumentConnection'
                ];

                const allRegistered = essentialCommands.every((cmd) => commands.includes(cmd));

                if (allRegistered) {
                    console.log('✅ Extension is ready');
                    return true;
                }
            }

            await new Promise((resolve) => setTimeout(resolve, 1000));
        }

        return false;
    }
}
