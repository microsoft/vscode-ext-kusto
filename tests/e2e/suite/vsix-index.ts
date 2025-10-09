import Mocha from 'mocha';
import * as path from 'path';
import { glob } from 'glob';

/**
 * VSIX Test Suite Index
 *
 * This file runs all VSIX-specific tests that require the extension to be
 * packaged and installed in a clean VS Code instance.
 */

export function run(): Promise<void> {
    // Create the mocha test runner
    const mocha = new Mocha({
        ui: 'tdd',
        color: true,
        timeout: 120000, // 2 minutes timeout for VSIX tests (need time for installation)
        reporter: process.env.CI ? 'spec' : 'spec'
    });

    const testsRoot = path.resolve(__dirname);
    const testLevel = process.env.E2E_TEST_LEVEL || 'smoke';

    console.log(`🔍 Running VSIX ${testLevel} level tests from: ${testsRoot}`);
    console.log(`📦 VSIX Path: ${process.env.VSIX_PATH}`);

    return new Promise((resolve, reject) => {
        // Determine VSIX test pattern based on level
        let testPattern: string;

        switch (testLevel) {
            case 'kql-vsix':
                testPattern = '**/kql-vsix.test.js';
                break;
            case 'kusto-commands-vsix':
                testPattern = '**/kusto-commands-vsix.test.js';
                break;
            case 'vsix-all':
                testPattern = '**/*-vsix.test.js';
                break;
            default:
                // Fallback to KQL VSIX tests for unknown levels
                testPattern = '**/kql-vsix.test.js';
        }

        console.log(`📋 VSIX Test Pattern: ${testPattern}`);

        // Find VSIX test files
        glob(testPattern, { cwd: testsRoot }, (err: Error | null, files: string[]) => {
            if (err) {
                console.error('❌ Failed to find VSIX test files:', err);
                return reject(err);
            }

            console.log(`📁 Found ${files.length} VSIX test files:`);
            files.forEach((file: string) => console.log(`  - ${file}`));

            if (files.length === 0) {
                console.log('⚠️  No VSIX test files found, nothing to run');
                return resolve();
            }

            // Add files to the test suite
            files.forEach((f: string) => {
                const testPath = path.resolve(testsRoot, f);
                console.log(`➕ Adding VSIX test file: ${testPath}`);
                mocha.addFile(testPath);
            });

            // Run the mocha test
            console.log('🚀 Starting VSIX test execution...');

            mocha.run((failures: number) => {
                if (failures > 0) {
                    console.error(`❌ ${failures} VSIX test(s) failed`);
                    reject(new Error(`${failures} VSIX tests failed.`));
                } else {
                    console.log('✅ All VSIX tests passed!');
                    resolve();
                }
            });
        });
    });
}
