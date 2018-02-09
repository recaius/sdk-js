const path = require('path');
const webpack = require('webpack');

module.exports = function (env) {
    let NODE_ENV = 'develop';
    let devtool = 'inline-source-map';
    let plugins = [];
    let resolve = {};
    // devserver時とrelease時のパス設定
    // devserverの時はbundleとindex.htmlはすべて/に
    // release時にはbundleはstaticに、index.htmlは/に配置
    let output = {
        path: path.resolve('dist'),
        filename: 'recaius.js',
        library: 'Recaius',
        // libraryTarget:'window',
    };

    if (process.env.NODE_ENV === 'production') {
        console.error("Production release");
        devtool = false;
        NODE_ENV = 'production';
        SERVERPORT = null;
        plugins.push(
            new webpack.optimize.UglifyJsPlugin({
                extractComments: true,
            })
        );
    }

    plugins.push(
        // new webpack.optimize.AggressiveMergingPlugin(),
        new webpack.DefinePlugin({
            'process.env': {
                'NODE_ENV': JSON.stringify(NODE_ENV)
            },
        }),
        new webpack.IgnorePlugin(/^request$/)
    );

    return {
        devtool: devtool,
        entry: ['./lib/index.js'],
        output: output,
        module: {
            rules: [
                {
                    test: /\.jsx?$/,
                    exclude: /node_modules/,
                    use: [
                        {
                            loader: 'babel-loader',
                            options: {
                                presets: [
                                    // env を指定することで、ES2017 を ES5 に変換。
                                    // {modules: false}にしないと import 文が Babel によって CommonJS に変換され、
                                    // webpack の Tree Shaking 機能が使えない
                                    ['env', { 'modules': false }]
                                ]
                            }
                        }
                    ],
                }
            ]
        },
        plugins: plugins,
        resolve: resolve,
    };
}
