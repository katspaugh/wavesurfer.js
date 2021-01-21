/* eslint-disable */
module.exports = {
    extends: ['eslint:recommended'], // extending recommended config and config derived from eslint-config-prettier
    parser: 'babel-eslint',
    globals: {
        WaveSurfer: true,
        Float32Array: true,
        Uint32Array: true,
        Promise: true,
        Uint8Array: true,
        ArrayBuffer: true,
        __VERSION__: true
    },
    env: {
        browser: true,
        commonjs: true
    },
    rules: {
        eqeqeq: 'off',
        'semi': 2,
        "indent": ["error", 4, {
            "ignoredNodes": ["TemplateLiteral"],
            "SwitchCase": 1
        }],
        'comma-dangle': ["error", "never"],
        'comma-spacing': ["error", { "before": false, "after": true }],
        'no-console': 1,
        'no-unused-vars': 'off',
        'no-var': 'error',
        'no-unreachable': 2,
        'no-extra-semi': "error",
        'no-multi-spaces': "error",
        'no-multiple-empty-lines': "error",
        'space-infix-ops': "error",
        'valid-jsdoc': [2, {
            'requireReturn': false,
            'requireReturnType': false
        }],
        'no-trailing-spaces': "error",
        'no-dupe-keys': "error",
        'require-jsdoc': 2,
        'no-duplicate-imports': "error",
        'space-before-function-paren': ["error", "never"],
        'keyword-spacing': ["error", {"before": true}]
    },
    'overrides': [
    {
        'files': ['example/**/*.js', 'spec/**/*.js'],
        'rules': {
            'no-console': 'off',
            'require-jsdoc': 0,
            'valid-jsdoc': 0
        }
    }]
};
