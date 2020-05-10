import { PluginHooks } from 'rollup'
import { ForkTsCheckerWebpackPlugin } from './ForkTsCheckerWebpackPlugin'

export default (
  options: Partial<ForkTsCheckerWebpackPlugin.Options>
): Partial<PluginHooks> => {
  const forkPlugin = new ForkTsCheckerWebpackPlugin(options)
  return {
    name: 'fork-ts-checker-webpack-plugin',
    options(inputOptions) {
      forkPlugin.options(inputOptions)
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
    // pluginStop() {

    // },
    writeBundle() {
      return forkPlugin.writeBundle()
    }
  }
}
