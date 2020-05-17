import path from 'path'
import * as helpers from './helpers'
import { RollupError, RollupWarning } from 'rollup'

describe('[INTEGRATION] specific tests for useTypescriptIncrementalApi: false', () => {
  let plugin: helpers.ForkTsCheckerWebpackPlugin

  function createCompiler(
    options: Partial<helpers.CreateCompilerOptions> = {}
  ) {
    const compiler = helpers.createCompiler({
      ...options,
      pluginOptions: {
        ...options.pluginOptions,
        useTypescriptIncrementalApi: false
      }
    })
    plugin = compiler.plugin
    return {
      compiler: compiler.compiler,
      watcher: compiler.watcher
    }
  }

  it('should work without configuration', async callback => {
    const errors: RollupWarning | RollupError[] = []
    const { compiler } = createCompiler({
      pluginOptions: {
        onError: err => errors.push(err),
        tsconfig: 'tsconfig-semantic-error-only.json'
      }
    })

    const bundle = await compiler()
    await bundle.generate({})
    expect(errors.length).toBeGreaterThanOrEqual(1)
    callback()
  })

  // ignore: happypack
  // it('should only show errors matching paths specified in reportFiles when provided', callback => {
  //   const compiler = createCompiler({
  //     pluginOptions: {
  //       checkSyntacticErrors: true,
  //       reportFiles: ['**/index.ts']
  //     },
  //     happyPackMode: true
  //   })

  //   // this test doesn't make as much sense in the context of using the incremental API
  //   // as in that case the compiler will stop looking for further errors when it finds one
  //   // see https://github.com/TypeStrong/fork-ts-checker-webpack-plugin/pull/198#issuecomment-453790649 for details
  //   compiler.run((error, stats) => {
  //     expect(stats.compilation.errors.length).toBe(1)
  //     expect(stats.compilation.errors[0]).toEqual(
  //       expect.objectContaining({ file: expect.stringMatching(/index.ts$/) })
  //     )
  //     callback()
  //   })
  // })

  it('should handle errors within the IncrementalChecker gracefully as diagnostic', async callback => {
    const errors: RollupWarning | RollupError[] = []
    const { compiler } = createCompiler({
      pluginOptions: {
        onError: err => errors.push(err)
      }
    })
    plugin['nodeArgs'] = [
      `--require`,
      `${path.resolve(__dirname, './mocks/IncrementalCheckerWithError.js')}`
    ]

    const bundle = await compiler()
    await bundle.generate({})
    expect(errors.length).toBe(1)
    expect(errors[0]).toEqual(
      expect.objectContaining({
        message: expect.stringContaining("I'm an error!")
      })
    )
    callback()
  })
})
