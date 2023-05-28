import path from 'path'

export default {
  mode: 'production',

  entry: {
    wavesurfer: './src/wavesurfer.ts',
  },
  resolve: {
    extensions: ['.ts', '.js', '.json'],
    extensionAlias: {
      '.js': '.ts',
    },
  },
  module: {
    rules: [
      {
        test: /\.ts$/,
        include: path.resolve('./src'),
        use: [
          {
            loader: 'ts-loader',
          },
        ],
      },
    ],
  },
  output: {
    library: 'WaveSurfer',
    libraryTarget: 'umd',
    libraryExport: 'default',
    globalObject: 'this',
    filename: '[name].min.js',
    path: path.resolve('./dist'),
  },
}
