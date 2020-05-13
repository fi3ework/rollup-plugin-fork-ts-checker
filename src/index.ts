import { PluginHooks } from 'rollup'
import { ForkTsCheckerWebpackPlugin } from './ForkTsCheckerWebpackPlugin'

export default (
  options: Partial<ForkTsCheckerWebpackPlugin.Options>,
  pluginInstance?: ForkTsCheckerWebpackPlugin
): Partial<PluginHooks> => {
  const forkPlugin = pluginInstance
    ? pluginInstance
    : new ForkTsCheckerWebpackPlugin(options)
  return {
    name: 'fork-ts-checker-webpack-plugin',
    options(inputOptions) {
      const pluginContext = this
      forkPlugin.options(inputOptions, pluginContext)
      return null
    },
    buildStart(options) {
      return forkPlugin.buildStart(options)
    },
    // @ts-ignore
    generateBundle() {
      const pluginContext = this
      return forkPlugin.generateBundle(pluginContext)
    },
    writeBundle() {
      return forkPlugin.writeBundle()
    }
  }
}
