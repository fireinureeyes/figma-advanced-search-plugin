/**
 * OPTIONAL — kept in the shape of your v1 config, extended to also build the UI.
 * `npm run build` uses esbuild (build.mjs); this file is only here if you'd
 * rather stay on webpack. It has NOT been run end to end — see REFACTOR-NOTES.
 *
 *   npm i -D html-webpack-plugin html-inline-script-webpack-plugin
 *   npx webpack --mode production
 */

const fs = require('node:fs');
const path = require('node:path');
const HtmlWebpackPlugin = require('html-webpack-plugin');
const HtmlInlineScriptPlugin = require('html-inline-script-webpack-plugin');

/** Fills the <!--CSS--> placeholder in src/ui/index.html at build time. */
class InlineCssPlugin {
  apply(compiler) {
    compiler.hooks.compilation.tap('InlineCssPlugin', (compilation) => {
      HtmlWebpackPlugin.getHooks(compilation).beforeEmit.tapAsync(
        'InlineCssPlugin',
        (data, callback) => {
          const css = fs.readFileSync(path.resolve(__dirname, 'src/ui/styles.css'), 'utf8');
          data.html = data.html.replace('<!--CSS-->', `<style>\n${css}\n</style>`);
          callback(null, data);
        },
      );
    });
  }
}

module.exports = (env, argv) => ({
  mode: argv.mode === 'production' ? 'production' : 'development',

  // This is necessary because Figma's 'eval' works differently than normal eval
  devtool: argv.mode === 'production' ? false : 'inline-source-map',

  entry: {
    // The sandbox entry point moved from src/code.ts to src/main/index.ts.
    code: './src/main/index.ts',
    // New in v2: the UI is TypeScript now and has to be bundled too.
    ui: './src/ui/main.ts',
  },
  module: {
    rules: [
      // Converts TypeScript code to JavaScript
      {
        test: /\.tsx?$/,
        use: 'ts-loader',
        exclude: /node_modules/,
      },
    ],
  },
  // Webpack tries these extensions for you if you omit the extension like "import './file'"
  resolve: {
    extensions: ['.ts', '.js'],
  },
  output: {
    filename: '[name].js',
    path: path.resolve(__dirname, 'dist'),
  },
  plugins: [
    // Figma loads the UI as a single HTML string (__html__), so the script and
    // the stylesheet both have to end up inline in dist/ui.html.
    new HtmlWebpackPlugin({
      template: './src/ui/index.html',
      filename: 'ui.html',
      chunks: ['ui'],
      inject: 'body',
      cache: false,
      minify: false,
    }),
    new InlineCssPlugin(),
    new HtmlInlineScriptPlugin({ htmlMatchPattern: [/ui\.html$/] }),
  ],
});
