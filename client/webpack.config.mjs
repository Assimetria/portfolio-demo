/**
 * Webpack 5 Configuration
 * Features: code splitting, tree shaking, gzip+brotli compression
 * Stack: React 18 + JavaScript + Tailwind CSS + shadcn/ui + lucide-react
 */

import path from 'path'
import { fileURLToPath } from 'url'
import { readFileSync } from 'fs'
import webpack from 'webpack'
import HtmlWebpackPlugin from 'html-webpack-plugin'
import MiniCssExtractPlugin from 'mini-css-extract-plugin'
import CssMinimizerPlugin from 'css-minimizer-webpack-plugin'
import TerserPlugin from 'terser-webpack-plugin'
import CompressionPlugin from 'compression-webpack-plugin'
import { BundleAnalyzerPlugin } from 'webpack-bundle-analyzer'
// ForkTsCheckerWebpackPlugin removed — JS-only project (Rule #267)
import ReactRefreshWebpackPlugin from '@pmmmwh/react-refresh-webpack-plugin'
import CopyPlugin from 'copy-webpack-plugin'
import zlib from 'zlib'
import { createRequire } from 'module'

// Shared font resolver (CommonJS) — same module apply-brand.js uses, so the
// <link> in index.html and --font-* in brand.css can never disagree.
const require = createRequire(import.meta.url)
const { resolveBrandFonts, googleFontsLinkTags, fontStack } = require('../scripts/lib/brand-fonts.cjs')
const { resolveBrand } = require('../scripts/apply-brand.js')
const { loadSiteContent } = require('../scripts/lib/site-content.cjs')
const siteHtml = require('../scripts/lib/site-html.cjs')

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

const isDev = process.env.NODE_ENV !== 'production'
const isAnalyze = process.env.ANALYZE === 'true'

// Load brand.json for the HTML template parameters (title/meta/JSON-LD + fonts).
// Accepts the canonical Orkosi camelCase shape and the legacy KickOff shape.
let brand = {}
try {
  brand = JSON.parse(readFileSync(path.resolve(__dirname, '../brand.json'), 'utf8'))
} catch (_) {}
const brandFonts = resolveBrandFonts(brand)
const resolvedBrand = resolveBrand(brand, { warn: (m) => console.warn(`[webpack] brand.json: ${m}`) })

// Merged informational site content (content/@system ← @generated ← @custom —
// the same three layers client/src/config/index.js merges at runtime). Drives
// <html lang>, the JSON-LD business node and the pre-hydration fallback markup
// in index.html. Throws when a content module is not pure data (see
// scripts/lib/site-content.cjs) — a broken layer must fail the build, not ship
// the Northwind defaults.
const site = loadSiteContent({ root: path.resolve(__dirname, '..') })
const brandColor = resolvedBrand.primaryColor
const jsonLd = JSON.stringify(
  siteHtml.siteJsonLd({ brand: resolvedBrand, site, logo: resolvedBrand.logoMark }),
  null,
  2,
).replace(/</g, '\\u003c')
const ogLocale = siteHtml.ogLocale(site)

export default {
  // ─── Mode & Entry ───────────────────────────────────────────────────────────
  mode: isDev ? 'development' : 'production',
  // Fail the production build on module errors. Without this, webpack still
  // emitted a bundle whose broken modules threw at runtime, so Docker builds
  // 'succeeded' and the deployed app showed only the ErrorBoundary.
  bail: !isDev,

  entry: {
    main: './src/main.jsx',
  },

  // ─── Output ─────────────────────────────────────────────────────────────────
  output: {
    path: path.resolve(__dirname, 'dist'),
    filename: isDev
      ? 'js/[name].js'
      : 'js/[name].[contenthash:8].js',
    chunkFilename: isDev
      ? 'js/[name].chunk.js'
      : 'js/[name].[contenthash:8].chunk.js',
    assetModuleFilename: 'assets/[name].[contenthash:8][ext]',
    publicPath: '/',
    clean: true,
  },

  // ─── Resolve ────────────────────────────────────────────────────────────────
  resolve: {
    extensions: ['.jsx', '.js', '.json'],
    alias: {
      // Root alias: @/ → src/
      '@': path.resolve(__dirname, 'src'),
      // Design system components: @system/ → src/app/components/@system/
      '@system': path.resolve(__dirname, 'src/app/components/@system'),
      // Product-specific custom components: @custom/ → src/app/components/@custom/
      '@custom': path.resolve(__dirname, 'src/app/components/@custom'),
    },
  },

  // ─── Tree Shaking ───────────────────────────────────────────────────────────
  // Tree shaking is enabled by default in production mode.
  // sideEffects: false in package.json instructs webpack to prune unused exports.
  // usedExports + concatenateModules (scope hoisting) maximize dead-code removal.
  optimization: {
    // Mark used exports so terser can drop dead code
    usedExports: true,

    // Scope hoisting: concatenate modules into fewer closures
    concatenateModules: !isDev,

    // ─── Code Splitting ───────────────────────────────────────────────────
    splitChunks: {
      chunks: 'all',
      minSize: 20_000,
      minChunks: 1,
      maxAsyncRequests: 8,
      maxInitialRequests: 8,
      cacheGroups: {
        // React runtime — changes rarely, cache long-term
        // Only include sync dependencies in main entrypoint
        react: {
          test: /[\\/]node_modules[\\/](react|react-dom|react-router|react-router-dom|scheduler)[\\/]/,
          name: 'vendor-react',
          chunks: 'initial',
          priority: 40,
          enforce: true,
        },

        // All other node_modules — only sync imports in main entrypoint
        // Heavy libraries (framer-motion, recharts, etc) used in lazy pages
        // will stay with their chunks or be extracted into separate async chunks
        vendors: {
          test: /[\\/]node_modules[\\/]/,
          name: 'vendors',
          chunks: 'initial',
          priority: 20,
          enforce: true,
        },

        // Shared dependencies between lazy chunks
        common: {
          name: 'common',
          minChunks: 2,
          chunks: 'async',
          priority: 10,
          reuseExistingChunk: true,
        },
      },
    },

    // Keep runtime chunk separate so vendor hashes don't change on app update
    runtimeChunk: 'single',

    minimizer: [
      // ─── JS Minification ──────────────────────────────────────────────
      new TerserPlugin({
        parallel: true,
        terserOptions: {
          parse: { ecma: 2020 },
          compress: {
            ecma: 5,
            comparisons: false,
            inline: 2,
            // Remove console.* in production
            drop_console: !isDev,
            drop_debugger: !isDev,
          },
          mangle: { safari10: true },
          output: {
            ecma: 5,
            comments: false,
            ascii_only: true,
          },
        },
      }),

      // ─── CSS Minification ─────────────────────────────────────────────
      new CssMinimizerPlugin({
        minimizerOptions: {
          preset: ['default', { discardComments: { removeAll: true } }],
        },
      }),
    ],
  },

  // ─── Module Rules ────────────────────────────────────────────────────────────
  module: {
    rules: [
      // Disable fullySpecified for .js/.mjs files so imports without extensions resolve
      {
        test: /\.m?js$/,
        resolve: { fullySpecified: false },
      },
      // JSX / JS
      {
        test: /\.[jt]sx?$/,
        exclude: /node_modules/,
        use: [
          {
            loader: 'babel-loader',
            options: {
              cacheDirectory: true,
              presets: [
                ['@babel/preset-env', { targets: 'defaults', modules: false }],
                ['@babel/preset-react', { runtime: 'automatic' }],
                '@babel/preset-typescript',
              ],
              plugins: [
                // Fast Refresh in dev
                isDev && 'react-refresh/babel',
              ].filter(Boolean),
            },
          },
        ],
      },

      // SCSS (pages/static/@system/AuthPage/index.scss) — sass → postcss → css
      {
        test: /\.scss$/,
        use: [
          isDev ? 'style-loader' : MiniCssExtractPlugin.loader,
          { loader: 'css-loader', options: { importLoaders: 2 } },
          { loader: 'postcss-loader', options: { postcssOptions: { config: path.resolve(__dirname, 'postcss.config.mjs') } } },
          'sass-loader',
        ],
      },
      // CSS / PostCSS (Tailwind)
      {
        test: /\.css$/,
        use: [
          isDev ? 'style-loader' : MiniCssExtractPlugin.loader,
          {
            loader: 'css-loader',
            options: { importLoaders: 1 },
          },
          {
            loader: 'postcss-loader',
            options: {
              postcssOptions: {
                config: path.resolve(__dirname, 'postcss.config.mjs'),
              },
            },
          },
        ],
      },

      // Images / fonts / SVGs as asset modules (Webpack 5 built-in)
      {
        test: /\.(png|jpg|jpeg|gif|webp|avif|svg)$/i,
        type: 'asset',
        parser: {
          // Inline assets < 8 KB as data URIs; larger → separate file
          dataUrlCondition: { maxSize: 8_192 },
        },
      },
      {
        test: /\.(woff|woff2|eot|ttf|otf)$/i,
        type: 'asset/resource',
      },
    ],
  },

  // ─── Plugins ─────────────────────────────────────────────────────────────────
  plugins: [
    // HTML entry point
    new HtmlWebpackPlugin({
      template: './index.html',
      inject: true,
      // Inject build-time env vars into HTML template (EJS syntax)
      templateParameters: {
        APP_URL: (process.env.VITE_APP_URL || '').startsWith('http') ? process.env.VITE_APP_URL : '',
        BRAND_NAME: siteHtml.escapeHtml(resolvedBrand.companyName),
        BRAND_TAGLINE: siteHtml.escapeHtml(resolvedBrand.tagline),
        BRAND_DESCRIPTION: siteHtml.escapeHtml(resolvedBrand.description || resolvedBrand.tagline),
        BRAND_COLOR: brandColor,
        BRAND_LOGO_MARK: resolvedBrand.logoMark,
        // Google Fonts <link> tags for the brand's heading/body/mono families
        // (deduped, weights 400–700, display=swap). Empty when only system fonts.
        GOOGLE_FONTS_LINK: googleFontsLinkTags(brandFonts),
        BRAND_FONT_BODY: fontStack(brandFonts.body, 'sans'),
        BRAND_FONT_HEADING: fontStack(brandFonts.heading, 'sans'),
        BRAND_FONT_MONO: fontStack(brandFonts.mono, 'mono'),
        // ── Informational site (brand.json `site` + content layers) ──────────
        HTML_LANG: siteHtml.htmlLang(site),
        OG_LOCALE_TAG: ogLocale ? `<meta property="og:locale" content="${ogLocale}" />` : '',
        SITE_TITLE: siteHtml.escapeHtml(siteHtml.siteTitle(site, resolvedBrand)),
        SITE_DESCRIPTION: siteHtml.escapeHtml(siteHtml.siteDescription(site, resolvedBrand)),
        OG_IMAGE: siteHtml.escapeHtml(siteHtml.ogImageUrl(site)),
        // One @graph block: <site.seo.businessType> (LocalBusiness family) + WebSite.
        JSON_LD: jsonLd,
        // Real site content for #root before React mounts (replaced by the
        // prerender snapshot when scripts/prerender.mjs can run).
        SITE_FALLBACK_HTML: siteHtml.siteFallbackHtml({
          brand: resolvedBrand,
          site,
          color: brandColor,
          fontBody: fontStack(brandFonts.body, 'sans'),
          logo: resolvedBrand.logoMark,
        }),
        // External analytics script or '' (site.analytics; never inline — CSP).
        ANALYTICS_TAG: siteHtml.analyticsTag(site),
      },
      // In production, minify the HTML
      minify: !isDev && {
        removeComments: true,
        collapseWhitespace: true,
        removeRedundantAttributes: true,
        useShortDoctype: true,
        removeEmptyAttributes: true,
        removeStyleLinkTypeAttributes: true,
        keepClosingSlash: true,
        // Keep minifyJS false so inline script CSP sha256 hashes stay stable
        // across builds. JS bundles are still fully minified by TerserPlugin. (#39126)
        minifyJS: false,
        minifyCSS: true,
        // minifyURLs removed — it converts __APP_URL__ placeholders to "/" (#30485)
      },
    }),

    // Extract CSS into separate files (production only)
    !isDev &&
      new MiniCssExtractPlugin({
        filename: 'css/[name].[contenthash:8].css',
        chunkFilename: 'css/[name].[contenthash:8].chunk.css',
      }),

    // TypeScript type checking removed — JS-only project (Rule #267)

    // Environment variables available in browser bundle
    // Define the full import.meta.env object so both static (import.meta.env.VITE_API_URL)
    // and dynamic (import.meta.env[key]) access patterns work — mirrors Vite behaviour.
    new webpack.DefinePlugin({
      'process.env.NODE_ENV': JSON.stringify(
        isDev ? 'development' : 'production'
      ),
      // Feature modules: brand.json `modules` → src/config/@system/modules.js.
      // Raw block (may be missing/empty); the client resolver applies the
      // all-enabled defaults, mirroring server/src/lib/@system/Helpers/modules.js.
      __MODULES__: JSON.stringify(brand.modules && typeof brand.modules === 'object' ? brand.modules : {}),
      'import.meta.env': JSON.stringify({
        ...Object.fromEntries(
          Object.entries(process.env).filter(([k]) => k.startsWith('VITE_'))
        ),
        MODE: isDev ? 'development' : 'production',
        PROD: !isDev,
        DEV: isDev,
        BASE_URL: '/',
      }),
    }),

    // ─── Compression ──────────────────────────────────────────────────────
    // Gzip — broad browser support
    !isDev &&
      new CompressionPlugin({
        filename: '[path][base].gz',
        algorithm: 'gzip',
        test: /\.(js|css|html|svg|json|ico|map)$/,
        threshold: 10_240, // Only compress files > 10 KB
        minRatio: 0.8,
        deleteOriginalAssets: false,
      }),

    // Brotli — better compression ratio for modern browsers
    !isDev &&
      new CompressionPlugin({
        filename: '[path][base].br',
        algorithm: 'brotliCompress',
        test: /\.(js|css|html|svg|json|ico|map)$/,
        threshold: 10_240,
        minRatio: 0.8,
        deleteOriginalAssets: false,
        compressionOptions: {
          params: {
            [zlib.constants.BROTLI_PARAM_QUALITY]: 11,
          },
        },
      }),

    // Copy public/ → dist/ so static assets (robots.txt, manifest.json, etc.) are served in prod.
    // Auto-asset pipeline: assets/logos/, assets/favicons/, assets/og/ are the SINGLE source of truth.
    // Products drop files in assets/ — template copies them everywhere automatically.
    new CopyPlugin({
      patterns: [
        {
          from: path.resolve(__dirname, 'public'),
          to: path.resolve(__dirname, 'dist'),
          globOptions: { ignore: ['**/index.html'] },
          noErrorOnMissing: true,
        },
        // Auto-asset pipeline: logos → /assets/logos/ (sidebar, header, auth, landing, dashboard)
        {
          from: path.resolve(__dirname, '../assets/logos'),
          to: path.resolve(__dirname, 'dist/assets/logos'),
          noErrorOnMissing: true,
        },
        // Auto-asset pipeline: favicons → root (standard /favicon.svg, /favicon.ico, etc.)
        // force: true ensures assets/ version overwrites any stale copies from public/
        {
          from: path.resolve(__dirname, '../assets/favicons'),
          to: path.resolve(__dirname, 'dist'),
          noErrorOnMissing: true,
          force: true,
        },
        // Auto-asset pipeline: OG images → /assets/og/ (social sharing previews)
        {
          from: path.resolve(__dirname, '../assets/og'),
          to: path.resolve(__dirname, 'dist/assets/og'),
          noErrorOnMissing: true,
        },
        // PWA manifest — copy to dist root so /manifest.json is served in dev builds (#31784)
        {
          from: path.resolve(__dirname, 'public/manifest.json'),
          to: path.resolve(__dirname, 'dist/manifest.json'),
          noErrorOnMissing: true,
        },
      ],
    }),

    // Fast Refresh (dev only)
    isDev && new ReactRefreshWebpackPlugin({ overlay: false }),

    // Bundle visualizer — run with ANALYZE=true npm run build
    isAnalyze &&
      new BundleAnalyzerPlugin({
        analyzerMode: 'static',
        reportFilename: '../bundle-report.html',
        openAnalyzer: true,
      }),
  ].filter(Boolean),

  // ─── Dev Server ──────────────────────────────────────────────────────────────
  devServer: {
    static: [
      // Standard public/ dir for robots.txt, manifest.json, sitemap.xml, etc.
      { directory: path.join(__dirname, 'public') },
      // Auto-asset pipeline: serve logos at /assets/logos/* in dev
      { directory: path.join(__dirname, '../assets/logos'), publicPath: '/assets/logos' },
      // Auto-asset pipeline: serve favicons at root in dev
      { directory: path.join(__dirname, '../assets/favicons'), publicPath: '/' },
      // Auto-asset pipeline: serve OG images at /assets/og/* in dev
      { directory: path.join(__dirname, '../assets/og'), publicPath: '/assets/og' },
    ],
    port: 3000,
    hot: true,
    open: false,
    compress: true,
    historyApiFallback: true, // SPA fallback for react-router
    // Explicitly watch @system + @custom trees. The leading `@` in these
    // directory names makes some watchers skip them (treating them like
    // scoped node_modules packages), which broke HMR for @system files.
    watchFiles: {
      paths: [
        'src/**/@system/**/*',
        'src/**/@custom/**/*',
        'src/**/*.{js,jsx,ts,tsx,css}',
      ],
      options: {
        usePolling: false,
        ignored: /node_modules/,
      },
    },
    proxy: [
      {
        context: ['/api'],
        target: 'http://localhost:3001',
        changeOrigin: true,
      },
    ],
  },

  // ─── Watch Options ───────────────────────────────────────────────────────────
  // Only ignore node_modules — the default `**/node_modules` glob can also match
  // paths whose segments start with `@`, silently dropping @system/@custom
  // watch events. Explicit regex avoids that ambiguity.
  watchOptions: {
    ignored: /node_modules/,
    aggregateTimeout: 200,
    poll: false,
  },

  // ─── Snapshot ────────────────────────────────────────────────────────────────
  // Prevent webpack from treating @system / @custom directories as "managed"
  // (immutable) paths. Managed paths are snapshotted by name+version instead
  // of by content hash, so edits under them wouldn't invalidate the module
  // cache and HMR would silently skip the change. Restricting managedPaths /
  // immutablePaths to real node_modules trees fixes reload on @system edits.
  snapshot: {
    managedPaths: [path.resolve(__dirname, 'node_modules')],
    immutablePaths: [],
    buildDependencies: { hash: true, timestamp: true },
    module: { hash: true, timestamp: true },
    resolve: { hash: true, timestamp: true },
    resolveBuildDependencies: { hash: true, timestamp: true },
  },

  // ─── Source Maps ─────────────────────────────────────────────────────────────
  devtool: isDev ? 'eval-source-map' : 'source-map',

  // ─── Performance Budget ──────────────────────────────────────────────────────
  // Hard budget: the production build FAILS when an emitted asset or the main
  // entrypoint grows past these limits, instead of printing a warning nobody
  // reads. Measured on 2026-09-20 (largest asset: the recharts chunk at 511,117 B;
  // main entrypoint runtime+vendor-react+vendors+main js+css: 774,300 B) plus a
  // 10 % allowance. Raise deliberately in the same commit that adds the weight,
  // and say why. Only the .js/.css files browsers download are judged — source
  // maps and the .gz/.br siblings CompressionPlugin emits are derived artefacts
  // (webpack's default filter misses `.map.gz`).
  performance: {
    hints: isDev ? false : 'error',
    maxAssetSize: 562_000,
    maxEntrypointSize: 852_000,
    assetFilter: (name) => /\.(?:js|css)$/.test(name),
  },

  // ─── Stats ───────────────────────────────────────────────────────────────────
  stats: {
    assets: true,
    chunks: false,
    modules: false,
    entrypoints: false,
    colors: true,
  },
}

