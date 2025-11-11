const path = require('path');
exports.ExtensionRootDir = path.dirname(__dirname);
exports.isWindows = /^win/.test(process.platform);
exports.isCI =
    process.env.TF_BUILD !== undefined || process.env.CI !== undefined || process.env.GITHUB_ACTIONS !== undefined;
