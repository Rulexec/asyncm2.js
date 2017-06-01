let webpack = require('webpack');

module.exports = {
	entry: './asyncm.js',

	output: {
		path: __dirname + '/dist',
		filename: 'asyncm.js'
	},
	
	module: {
		loaders: [
			{test: /\.js$/,
			 exclude: /(node_modules)/,
			 loader: 'babel-loader',
			 query: {
				 presets: ['es2015']
			 }}
		]
	},
	
	plugins: [
		new webpack.optimize.UglifyJsPlugin({
			compress: {
				warnings: false
			}
		})
	]
};