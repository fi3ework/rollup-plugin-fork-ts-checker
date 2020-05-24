# rollup-plugin-fork-ts-checker

> The project is currently in alpha phase.

[fork-ts-checker-webpack-plugin](https://github.com/TypeStrong/fork-ts-checker-webpack-plugin) is a great Webpack plugin that saves time from waiting for type checking. This repo heavily relies on fork-ts-checker-webpack-plugin, core logic of type checking is directly imported from it, with a adapation for Rollup.

![npm](https://img.shields.io/npm/v/rollup-plugin-fork-ts-checker) ![CI](https://github.com/fi3ework/rollup-plugin-fork-ts-checker/workflows/CI/badge.svg) ![npm](https://img.shields.io/npm/dw/rollup-plugin-fork-ts-checker)

## Usage

Install with NPM

```bash
npm i fork-ts-checker-webpack-plugin -D
```

or with Yarn

```bash
yarn add fork-ts-checker-webpack-plugin -D
```

The original idea for this plugin was to work with [rollup-plugin-typescript2](https://github.com/ezolenko/rollup-plugin-typescript2). It also could work with and none type checking TypeScript compile tool.

Here's a simple Rollup config example work with rpt2:

```js
const rpt2 = require('rollup-plugin-typescript2')
const ftc = require('rollup-plugin-fork-ts-checker').default

export default {
  input: 'src/index.ts',
  plugins: [
    ftc({
      // Plugin options, mostly same as fork-ts-checker-webpack-plugin.
      // See https://github.com/TypeStrong/fork-ts-checker-webpack-plugin#options
      // Some options can't be supported. See Caveat section for detail.
    }),
    rpt2({
      // Disable type checking of compiler, leave it to ftc.
      check: false
    })
  ],
  output: {
    file: 'bundle.js',
    format: 'cjs'
  }
}
```

## Caveat

Most options are completely same as [fork-ts-checker-webpack-plugin](https://github.com/TypeStrong/fork-ts-checker-webpack-plugin#options). But some functionality can not be supported.

- Webpack related configurations (e.g. ts-loader, happypack).
- Vue (could be supported, still WIP).

## License

MIT
