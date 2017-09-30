module.exports = {
    extends: ['eslint:recommended'], // extending recommended config and config derived from eslint-config-prettier
    plugins: ['prettier'], // activating esling-plugin-prettier (--fix stuff)
    parser: 'babel-eslint',
    globals: {
        WaveSurfer: true,
        Float32Array: true,
        Uint32Array: true,
        Promise: true,
        Uint8Array: true
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
                trailingComma: 'none'
            }
        ],
        eqeqeq: 'off',
        'no-console': 'off',
        'no-unused-vars': 'off'
    }
};
