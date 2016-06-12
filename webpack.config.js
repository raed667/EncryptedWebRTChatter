var path = require('path')
var webpack = require('webpack')

module.exports = {
  context: path.join(__dirname, 'js'),
  entry: {
    adapter: './adapter.js',
    util: './util.js',
    webcrypto: './webcrypto.js',
    serverlessWebrtc: './serverless-webrtc.js',
    fileTransfer: './file-transfer.js'
  },
  output: {
    path: path.join(__dirname, 'dist'),
    filename: 'bundle.js'
  },
  devtool: 'source-map',
  module: {
    loaders: [
      {
        test: /\.js?$/,
        exclude: /(node_modules|bower_components|dist)/,
        loader: 'babel'
      },
      {
        test: /\.css$/,
        loaders: [
          'style?sourceMap',
          'css?modules&importLoaders=1&localIdentName=[path]___[name]__[local]___[hash:base64:5]'
        ]
      }
    ]
  },
  plugins: [
    new webpack.EnvironmentPlugin([
      'NODE_ENV'
    ])
  ]
}
