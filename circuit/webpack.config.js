const path = require('path');
const webpack = require('webpack');
module.exports = {
  entry: './lib/rollup.js',
  resolve: {
      fallback: {
        "crypto": require.resolve("crypto-browserify"),
	"util": require.resolve("util/"),
	"os": require.resolve("os-browserify/browser"),
        "stream": require.resolve("stream-browserify"),
        "fs": false
      }
  },
  output: {
    path: path.resolve(__dirname, 'dist'),
    filename: 'bundle.js',
  },
   plugins: [
        new webpack.ProvidePlugin({
            process: 'process/browser',
            Buffer: ['buffer', 'Buffer'],
        }),
    ]
};
