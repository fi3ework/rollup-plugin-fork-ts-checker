import { Plugin } from 'rollup'
import { ForkTsCheckerWebpackPlugin } from './ForkTsCheckerPlugin'

export default (
  options: Partial<ForkTsCheckerWebpackPlugin.Options>,
  pluginInstance?: ForkTsCheckerWebpackPlugin
): Plugin => {
  const forkPlugin = pluginInstance
    ? pluginInstance
    : new ForkTsCheckerWebpackPlugin(options)
  return {
    name: 'fork-ts-checker-webpack-plugin',
    options(inputOptions) {
      forkPlugin.options(inputOptions)
      return null
    },
    buildStart(options) {
      return forkPlugin.buildStart(options)
    },
    buildEnd() {
      return forkPlugin.buildEnd()
    },
    async generateBundle() {
      const pluginContext = this
      await forkPlugin.generateBundle(pluginContext)
    },
    async writeBundle() {
      forkPlugin.writeBundle()
      return
    }
  }
}
