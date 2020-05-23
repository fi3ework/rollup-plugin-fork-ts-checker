# rollup-plugin-fork-ts-checker

> ⚠️ This project is still under development.

[fork-ts-checker-webpack-plugin](https://github.com/TypeStrong/fork-ts-checker-webpack-plugin) is a great Webpack plugin that saves time from waiting for type checking. This repo heavily relies on fork-ts-checker-webpack-plugin, core logic of type checking is directly imported from it, with a adapation for Rollup.

## Usage

The original idea for this plugin was to work with [rollup-plugin-typescript2](https://github.com/ezolenko/rollup-plugin-typescript2). Simple config example:

```js
const rpt2 = require('rollup-plugin-typescript2')
const ftc = require('rollup-plugin-fork-ts-checker').default

export default {
  input: 'src/a.ts',
  plugins: [
    ftc({
      // YOUR OPTIONS
      // See https://github.com/TypeStrong/fork-ts-checker-webpack-plugin#options
    }),
    rpt2({
      check: false
    })
  ],
  output: {
    file: 'bundle.js',
    format: 'cjs'
  }
}
```

## Options

Most options are completely same as [fork-ts-checker-webpack-plugin](https://github.com/TypeStrong/fork-ts-checker-webpack-plugin#options). But some functionality can not be supported.

- webpack-specific configurations (e.g. ts-loader).
- vue (WIP)

## License

MIT
