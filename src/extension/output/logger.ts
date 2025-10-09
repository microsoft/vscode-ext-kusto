import * as vscode from 'vscode';

export class LoggerFactory {
    private static instances: Map<string, Logger> = new Map();

    public static getLogger(name: string): Logger {
        if (!this.instances.has(name)) {
            this.instances.set(name, new Logger(name));
        }
        const logger = this.instances.get(name);
        if (!logger) {
            throw new Error(`Logger instance for "${name}" not found.`);
        }
        return logger;
    }
}

class Logger {
    private outputChannel: vscode.OutputChannel | undefined;

    constructor(private readonly name: string) {}

    private ensureChannel(): vscode.OutputChannel {
        if (!this.outputChannel) {
            this.outputChannel = vscode.window.createOutputChannel(this.name);
        }
        return this.outputChannel;
    }

    public log(message: string): void {
        this.ensureChannel().appendLine(`[${new Date().toISOString()}] ${message}`);
    }

    public error(message: string, error?: Error): void {
        const channel = this.ensureChannel();
        channel.appendLine(`[ERROR ${new Date().toISOString()}] ${message}`);
        if (error) {
            channel.appendLine(error.stack || error.message);
        }
    }

    public show(): void {
        this.ensureChannel().show();
    }
}
