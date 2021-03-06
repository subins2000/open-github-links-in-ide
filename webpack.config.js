const path = require("path")
const { CleanWebpackPlugin } = require("clean-webpack-plugin")
const CopyWebpackPlugin = require("copy-webpack-plugin")
const TerserJSPlugin = require("terser-webpack-plugin")
const HtmlWebpackPlugin = require("html-webpack-plugin")
const MiniCssExtractPlugin = require("mini-css-extract-plugin")
const OptimizeCssAssetsPlugin = require("optimize-css-assets-webpack-plugin")
const ZipWebpackPlugin = require("zip-webpack-plugin")
const ExtensionReloader = require("webpack-extension-reloader")

const generatePlugins = (env, mode, browser) => {
  const plugins = [
    new CleanWebpackPlugin({
      cleanStaleWebpackAssets: false,
    }),
    new CopyWebpackPlugin({
      patterns: [
        { from: "icons", to: "icons" },
        {
          from: "manifest.json",
          transform: content => {
            const manifest = {
              description: process.env.npm_package_description,
              version: process.env.npm_package_version,
              ...JSON.parse(content.toString()),
            }
            if (mode === "development") {
              manifest.content_security_policy = "script-src 'self' 'unsafe-eval'; object-src 'self'"
            }
            if (mode === "development" || env.test) {
              manifest.content_scripts.forEach(script => {
                script.all_frames = true // allow cypress tests
              })
            }
            if (browser === "firefox") {
              manifest.browser_specific_settings = {
                gecko: {
                  id: process.env.npm_package_geckoId,
                },
              }
            }
            return Buffer.from(JSON.stringify(manifest))
          },
        },
      ],
    }),
    new MiniCssExtractPlugin(),
    new HtmlWebpackPlugin({
      template: "popup.html",
      filename: "popup.html",
      chunks: ["popup"],
    }),
  ]

  if (mode === "development") {
    plugins.push(
      new ExtensionReloader({
        port: browser === "chrome" ? 9090 : 9091,
        reloadPage: true,
        manifest: "./src/manifest.json",
      }),
    )
  }

  if (mode === "production") {
    plugins.push(
      new ZipWebpackPlugin({
        path: path.join(__dirname, "build"),
        filename: `${browser}.zip`,
      }),
    )
  }

  return plugins
}

const generateWebpackConfig = (env, mode, browser) => {
  return {
    stats: "minimal",
    watch: mode === "development",
    context: path.join(__dirname, "src"),
    output: {
      path: path.join(__dirname, `dist/${browser}`),
    },
    entry: {
      inject: "./inject.js",
      background: "./background.js",
      popup: "./popup.js",
    },
    module: {
      rules: [
        {
          test: /\.css$/,
          use: [MiniCssExtractPlugin.loader, "css-loader"],
        },
      ],
    },
    optimization: {
      minimizer: [new TerserJSPlugin(), new OptimizeCssAssetsPlugin()],
    },
    plugins: generatePlugins(env, mode, browser),
  }
}

module.exports = (env = {}, argv) => [
  generateWebpackConfig(env, argv.mode, "chrome"),
  generateWebpackConfig(env, argv.mode, "firefox"),
]
