var webpack = require('webpack');
var path = require('path');

module.exports = {
  //...
  entry: ['@babel/polyfill', './src/index.js'],
  devServer: {
    contentBase: path.join(__dirname, 'dist'),
    compress: true,
    port: 9000,
  },
  resolve: {
      fallback: {
        "crypto": require.resolve("crypto-browserify"),
	"os": require.resolve("os-browserify/browser"),
        "stream": require.resolve("stream-browserify"),
        "fs": false
      }
  },
  plugins: [
        new webpack.ProvidePlugin({
            process: 'process/browser',
            Buffer: ['buffer', 'Buffer'],
        }),
    ],
  experiments: {
    topLevelAwait: true,
  }

}
