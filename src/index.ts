import { PluginHooks } from 'rollup'
import { ForkTsCheckerWebpackPlugin } from './ForkTsCheckerWebpackPlugin'

// TODO: options
export default (): Partial<PluginHooks> => {
  const forkPlugin = new ForkTsCheckerWebpackPlugin()
  return {
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
