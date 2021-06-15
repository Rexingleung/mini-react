var path = require('path');
var webpack = require('webpack');
var HtmlWebpackPlugin = require('html-webpack-plugin');
var { CleanWebpackPlugin } = require('clean-webpack-plugin');// 用于删除/清理构建文件夹的 webpack 插件。 默认情况下，此插件将output.path在每次成功重建后删除 webpack目录中的所有文件，以及所有未使用的 webpack 资产。
var friendlyErrorsWebpackPlugin = require('friendly-errors-webpack-plugin'); // 友好提示
module.exports = {
  entry: [
    'webpack-hot-middleware/client?path=/__webpack_hmr&timeout=20000',
    path.resolve(__dirname, './src/index.js'),
  ],
  output: {
    path: path.resolve(__dirname, './build'),
    filename: '[name].bundle.js',
    publicPath: '/', 
  },
  mode: 'development',
  module: {
    rules: [
      {
        test: /\.m?js$/,
        exclude: /node_modules/,
        use: {
          loader: 'babel-loader',
          options: {
            presets: ['@babel/preset-env']
          }
        }
      }
    ]
  },
  devtool: 'inline-source-map', // 配置source-map
  plugins: [
    new HtmlWebpackPlugin({
      template: path.resolve(__dirname, './public/index.html'),
      filename: 'index.html'
    }),
    new CleanWebpackPlugin(),
    new friendlyErrorsWebpackPlugin(),
    new webpack.HotModuleReplacementPlugin(), // 启动HMR
    new webpack.NoEmitOnErrorsPlugin() // 在编译出现错误时，使用 NoEmitOnErrorsPlugin 来跳过输出阶段。这样可以确保输出资源不会包含错误。
  ]
}