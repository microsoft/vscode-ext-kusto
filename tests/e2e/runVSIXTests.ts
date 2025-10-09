import * as path from 'path';
import * as fs from 'fs';
import { runTests, downloadAndUnzipVSCode, resolveCliArgsFromVSCodeExecutablePath } from '@vscode/test-electron';

/**
 * Enhanced E2E Test Runner with VSIX Support
 *
 * Based on Red Hat's vscode-extension-tester approach:
 * - Builds extension as VSIX package
 * - Installs into isolated VS Code instance
 * - Runs automated UI tests
 * - Supports multiple test levels
 */

interface TestConfig {
    extensionPath: string;
    vsixPath?: string;
    testSuite: 'smoke' | 'integration' | 'ui' | 'all';
    vscodeVersion?: string;
    workspaceDir?: string;
    settings?: any;
}

class VSIXTestRunner {
    private workspaceRoot: string;
    private testResourcesPath: string;
    private vscodePath?: string;

    constructor() {
        this.workspaceRoot = path.resolve(__dirname, '../../..');
        this.testResourcesPath = path.join(this.workspaceRoot, 'test-resources');
        this.ensureTestResourcesDir();
    }

    private ensureTestResourcesDir(): void {
        if (!fs.existsSync(this.testResourcesPath)) {
            fs.mkdirSync(this.testResourcesPath, { recursive: true });
        }
    }

    /**
     * Build extension as VSIX package
     */
    async buildVSIX(): Promise<string> {
        const { spawn } = await import('child_process');
        const vsixPath = path.join(this.workspaceRoot, 'kusto-notebooks.vsix');

        console.log('🔨 Building extension VSIX package...');

        return new Promise((resolve, reject) => {
            // First run the prepublish script (webpack production build)
            const prepublish = spawn('npm', ['run', 'vscode:prepublish'], {
                cwd: this.workspaceRoot,
                stdio: 'inherit',
                shell: true
            });

            prepublish.on('close', (code) => {
                if (code !== 0) {
                    reject(new Error(`vscode:prepublish failed with code ${code}`));
                    return;
                }

                // Then package the extension
                const packageCmd = spawn('npm', ['run', 'package'], {
                    cwd: this.workspaceRoot,
                    stdio: 'inherit',
                    shell: true
                });

                packageCmd.on('close', (packageCode) => {
                    if (packageCode !== 0) {
                        reject(new Error(`package failed with code ${packageCode}`));
                        return;
                    }

                    if (fs.existsSync(vsixPath)) {
                        console.log(`✅ VSIX package created: ${vsixPath}`);
                        resolve(vsixPath);
                    } else {
                        reject(new Error('VSIX package not found after build'));
                    }
                });
            });
        });
    }

    /**
     * Download and setup VS Code instance for testing
     */
    async setupVSCode(version = 'stable'): Promise<string> {
        console.log(`📥 Downloading VS Code ${version}... | ${process.platform} | ${this.testResourcesPath}`);

        const vscodeExecutablePath = await downloadAndUnzipVSCode({
            version,
            cachePath: this.testResourcesPath
        });

        this.vscodePath = vscodeExecutablePath;
        console.log(`✅ VS Code ready at: ${vscodeExecutablePath}`);

        return vscodeExecutablePath;
    }

    /**
     * Install extension from VSIX into test VS Code instance
     */
    async installExtension(vsixPath: string, vscodeExecutablePath: string): Promise<void> {
        const { spawn } = await import('child_process');

        console.log('📦 Installing extension from VSIX...');

        // Get CLI path from VS Code executable
        const [cli] = resolveCliArgsFromVSCodeExecutablePath(vscodeExecutablePath);

        return new Promise((resolve, reject) => {
            const installCmd = spawn(cli, ['--install-extension', vsixPath], {
                stdio: 'inherit'
            });

            installCmd.on('close', (code) => {
                if (code !== 0) {
                    reject(new Error(`Extension installation failed with code ${code}`));
                    return;
                }
                console.log('✅ Extension installed successfully');
                resolve();
            });
        });
    }

    /**
     * Run E2E tests with installed extension
     */
    async runTests(config: TestConfig): Promise<void> {
        const vscodeExecutablePath = this.vscodePath || (await this.setupVSCode(config.vscodeVersion));

        // Build VSIX if not provided
        const vsixPath = config.vsixPath || (await this.buildVSIX());

        // Install extension
        await this.installExtension(vsixPath, vscodeExecutablePath);

        // Prepare test workspace
        const testWorkspace = config.workspaceDir || path.join(__dirname, '../fixtures/test-workspace');

        // Select test suite
        // Use the VSIX-specific test index entry point
        const testSuitePath = path.resolve(__dirname, 'vsix-index.js');

        console.log(`🧪 Running ${config.testSuite} tests...`);

        try {
            await runTests({
                vscodeExecutablePath,
                extensionDevelopmentPath: config.extensionPath,
                extensionTestsPath: testSuitePath,
                launchArgs: [
                    testWorkspace,
                    '--disable-extensions', // Disable other extensions for clean testing
                    '--disable-workspace-trust', // Skip trust dialog
                    '--skip-welcome', // Skip welcome screen
                    '--disable-telemetry' // Disable telemetry
                ],
                extensionTestsEnv: {
                    E2E_TEST_LEVEL: config.testSuite,
                    VSIX_PATH: vsixPath,
                    TEST_RESOURCES_PATH: this.testResourcesPath,
                    ...process.env
                }
            });

            console.log('✅ All tests completed successfully!');
        } catch (error) {
            console.error('❌ Tests failed:', error);
            throw error;
        }
    }

    /**
     * Cleanup test resources
     */
    async cleanup(): Promise<void> {
        console.log('🧹 Cleaning up test resources...');

        // Remove VSIX file
        const vsixPath = path.join(this.workspaceRoot, 'kusto-notebooks.vsix');
        if (fs.existsSync(vsixPath)) {
            fs.unlinkSync(vsixPath);
        }

        // Note: Keep test-resources directory for faster subsequent runs
        // Users can manually delete it if needed
        console.log('✅ Cleanup completed');
    }
}

/**
 * Main test execution function
 */
async function main(): Promise<void> {
    const testLevel = (process.env.E2E_TEST_LEVEL as any) || 'smoke';
    const vscodeVersion = process.env.VSCODE_VERSION || 'stable';

    const runner = new VSIXTestRunner();

    const config: TestConfig = {
        extensionPath: path.resolve(__dirname, '../../..'),
        testSuite: testLevel,
        vscodeVersion
    };

    try {
        console.log('🚀 Starting Enhanced E2E Tests with VSIX');
        console.log(`📋 Test Suite: ${config.testSuite}`);
        console.log(`📋 VS Code Version: ${config.vscodeVersion}`);
        console.log('');

        await runner.runTests(config);

        console.log('');
        console.log('🎉 Enhanced E2E Tests completed successfully!');
    } catch (error) {
        console.error('💥 Enhanced E2E Tests failed:', error);
        process.exit(1);
    } finally {
        if (process.env.CLEANUP_AFTER_TESTS !== 'false') {
            await runner.cleanup();
        }
    }
}

// Export for use in other test files
export { VSIXTestRunner, TestConfig };

// Run if executed directly
if (require.main === module) {
    main().catch((error) => {
        console.error('Fatal error:', error);
        process.exit(1);
    });
}
