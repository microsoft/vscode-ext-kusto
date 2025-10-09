import * as path from 'path';
import { glob } from 'glob';

// Import Mocha properly
const Mocha = require('mocha');

/**
 * VSIX Test Index
 *
 * Entry point for VSIX-based tests that runs after the extension is packaged
 * and installed in a fresh VS Code instance.
 */
export function run(): Promise<void> {
    // Create the mocha test
    const mocha = new Mocha({
        ui: 'tdd', // Use TDD style to match existing E2E test pattern (suite/test instead of describe/it)
        color: true,
        timeout: 120000, // 2 minutes - longer timeout for VSIX tests
        reporter: 'spec'
    });

    const testsRoot = path.resolve(__dirname, '.');

    return new Promise((c, e) => {
        // Get test suite from environment variable
        const testLevel = process.env.E2E_TEST_LEVEL || 'comprehensive';

        console.log(`🚀 Running VSIX test suite: ${testLevel}`);
        console.log(`📁 Tests root: ${testsRoot}`);

        // Map test levels to specific test files
        const testFileMap: { [key: string]: string } = {
            comprehensive: 'comprehensive-vsix.test.js', // Comprehensive test suite
            connection: 'adx-real-connection.test.js',
            all: '*vsix*.test.js'
        };

        const testFile = testFileMap[testLevel];

        if (testFile) {
            if (testFile.includes('*')) {
                // Handle glob patterns for 'all' test level
                const files = glob.sync(testFile, { cwd: path.join(testsRoot, 'suite') });
                console.log(`📋 Running ${files.length} test files matching pattern: ${testFile}`);

                files.forEach((f) => {
                    const testPath = path.resolve(testsRoot, 'suite', f);
                    console.log(`📄 Adding test file: ${testPath}`);
                    mocha.addFile(testPath);
                });

                if (files.length === 0) {
                    console.log(`⚠️ No test files found matching pattern: ${testFile}`);
                    return c();
                }
            } else {
                // Single test file
                const testPath = path.resolve(testsRoot, 'suite', testFile);
                console.log(`📋 Running test file: ${testPath}`);

                try {
                    mocha.addFile(testPath);
                } catch (error) {
                    console.error(`❌ Error adding test file: ${error}`);
                    return e(error);
                }
            }
        } else {
            // Fallback: run all VSIX test files
            console.log(`⚠️ Unknown test level '${testLevel}', running all VSIX tests`);

            try {
                const files = glob.sync('suite/*vsix*.test.js', { cwd: testsRoot });

                // Add files to the test suite
                files.forEach((f) => {
                    const testPath = path.resolve(testsRoot, f);
                    console.log(`📋 Adding test file: ${testPath}`);
                    mocha.addFile(testPath);
                });
            } catch (error) {
                console.error(`❌ Error finding test files: ${error}`);
                return e(error);
            }
        }

        try {
            // Run the mocha test
            console.log('🏃 Starting test execution...');
            mocha.run((failures) => {
                if (failures > 0) {
                    console.error(`❌ ${failures} test(s) failed`);
                    e(new Error(`${failures} tests failed.`));
                } else {
                    console.log('✅ All VSIX tests passed!');
                    c();
                }
            });
        } catch (err) {
            console.error(`❌ Error running tests: ${err}`);
            e(err);
        }
    });
}
