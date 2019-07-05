module.exports = {
    extends: ['eslint:recommended'], // extending recommended config and config derived from eslint-config-prettier
    plugins: ['prettier'], // activating esling-plugin-prettier (--fix stuff)
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
        'prettier/prettier': [
            // customizing prettier rules (unfortunately not many of them are customizable)
            'error',
            {
                singleQuote: true,
                tabWidth: 4,
                trailingComma: 'none',
                'endOfLine': 'auto'
            }
        ],
        eqeqeq: 'off',
        'semi': 2,
        'no-console': 1,
        'no-unused-vars': 'off',
        'no-unreachable': 2,
        'valid-jsdoc': [2, {
            'requireReturn': false,
            'requireReturnType': false
        }],
        'require-jsdoc': 2
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
