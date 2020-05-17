import * as path from 'path'
import { RpcProvider } from 'worker-rpc'
import VuePlugin from 'rollup-plugin-vue'
// @ts-ignore
import postcss from 'rollup-plugin-postcss'

// eslint-disable-next-line @typescript-eslint/ban-ts-ignore
// @ts-ignore
import { rpcMethods } from './rpc'
import { CreateCompilerOptions, createCompiler } from '.'

// let VueLoaderPlugin: typeof VueLoader.VueLoaderPlugin
// try {
//   VueLoaderPlugin = require('vue-loader/lib/plugin')
// } catch {
//   /** older versions of vue-loader come without that import - that's fine. */
// }

export async function createVueCompiler({
  context = './vue',
  nodeRequires = [],
  prepareRollupConfig = x => x,
  ...otherOptions
}: Partial<CreateCompilerOptions> = {}) {
  const results = createCompiler({
    ...otherOptions,
    context,
    nodeRequires: [
      ...nodeRequires,
      '../mocks/IncrementalCheckerWithRpc.js',
      '../mocks/ApiIncrementalCheckerWithRpc.js'
    ],
    prepareRollupConfig(config) {
      return prepareRollupConfig({
        ...config,
        external: ['vue', 'vue-class-component'],
        // @ts-ignore
        plugins: [
          ...(config.plugins || []),
          ...[
            postcss({
              extract: true
            }),
            VuePlugin({
              css: false
            })
          ]
        ]
      })
    }
  })

  const { compilerConfig, plugin } = results

  const files = {
    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
    'example.vue': path.resolve(compilerConfig.context!, 'src/example.vue'),
    'syntacticError.ts': path.resolve(
      // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
      compilerConfig.context!,
      'src/syntacticError.ts'
    )
  }

  let rpcProvider: RpcProvider

  const initSpawn = async () => {
    plugin['spawnService']()
    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
    rpcProvider = plugin['serviceRpc']!
    await rpcProvider.rpc(rpcMethods.nextIteration)
  }

  return {
    ...results,
    files,
    // @ts-ignore
    rpcProvider,
    initSpawn,
    getKnownFileNames(): Promise<string[]> {
      return rpcProvider.rpc(rpcMethods.getKnownFileNames)
    },
    getSourceFile(fileName: string): Promise<{ text: string } | undefined> {
      return rpcProvider.rpc(rpcMethods.getSourceFile, fileName)
    },
    getSyntacticDiagnostics(): Promise<
      { start: number; length: number; file: { text: string } }[] | undefined
    > {
      return rpcProvider.rpc(rpcMethods.getSyntacticDiagnostics)
    }
  }
}
