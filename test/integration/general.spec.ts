import path from 'path'
import {
  ForkTsCheckerWebpackPlugin,
  withRawMessage
} from '../../lib/ForkTsCheckerPlugin'
import * as helpers from './helpers'
import { cloneDeep } from 'lodash'
import unixify from 'unixify'
import * as semver from 'semver'
import { RollupError, RollupWarning } from 'rollup'

describe.each([[true]])(
  '[INTEGRATION] common tests - useTypescriptIncrementalApi: %s',
  useTypescriptIncrementalApi => {
    let compilerPlugin: ForkTsCheckerWebpackPlugin

    const overrideOptions = { useTypescriptIncrementalApi }

    function createCompiler(
      options: Partial<helpers.CreateCompilerOptions> = {}
    ) {
      const compiler = helpers.createCompiler({
        ...options,
        pluginOptions: { ...options.pluginOptions, ...overrideOptions }
      })
      // @ts-ignore
      compilerPlugin = compiler.plugin
      return {
        compiler: compiler.compiler,
        watcher: compiler.watcher
      }
    }

    const ifNotIncrementalIt = useTypescriptIncrementalApi ? it.skip : it
    const ifNodeGte8It = semver.lt(process.version, '8.10.0') ? it.skip : it
    const ifNodeLt8It = semver.lt(process.version, '8.10.0') ? it : it.skip

    /**
     * Implicitly check whether killService was called by checking that
     * the service property was set to undefined.
     * @returns [boolean] true if killService was called
     */
    function killServiceWasCalled() {
      return compilerPlugin['service'] === undefined
    }

    it('should allow to pass no options', () => {
      expect(() => {
        new ForkTsCheckerWebpackPlugin()
      }).not.toThrowError()
    })

    it('should detect paths', () => {
      const plugin = new ForkTsCheckerWebpackPlugin({})

      expect(plugin['tsconfig']).toBe('./tsconfig.json')
    })

    it('should set logger to console by default', () => {
      const plugin = new ForkTsCheckerWebpackPlugin({})

      expect(plugin['logger']).toBe(console)
    })

    it('should find semantic errors', async callback => {
      const errors: RollupWarning | RollupError[] = []

      const { compiler } = createCompiler({
        pluginOptions: {
          onError: err => errors.push(err),
          tsconfig: 'tsconfig-semantic-error-only.json'
        }
      })

      const bundle = await compiler()
      await bundle.generate({})
      callback()
      expect(errors.length).toBeGreaterThanOrEqual(1)
      callback()
    })

    it('should support custom resolution', async callback => {
      const warnings: RollupWarning | RollupError[] = []

      const { compiler } = createCompiler({
        pluginOptions: {
          onWarn: err => warnings.push(err),
          tsconfig: 'tsconfig-weird-resolutions.json',
          resolveModuleNameModule: path.resolve(
            __dirname,
            '../fixtures/project/',
            'weirdResolver.js'
          ),
          resolveTypeReferenceDirectiveModule: path.resolve(
            __dirname,
            '../fixtures/project/',
            'weirdResolver.js'
          )
        }
      })

      const bundle = await compiler()
      await bundle.generate({})
      callback()
      expect(warnings.length).toBe(0)
      callback()
    })

    ifNotIncrementalIt(
      'should support custom resolution w/ "paths"',
      async callback => {
        const warnings: RollupWarning | RollupError[] = []

        const { compiler } = createCompiler({
          pluginOptions: {
            onWarn: err => warnings.push(err),
            tsconfig: 'tsconfig-weird-resolutions-with-paths.json',
            resolveModuleNameModule: path.resolve(
              __dirname,
              '../fixtures/project/',
              'weirdResolver.js'
            ),
            resolveTypeReferenceDirectiveModule: path.resolve(
              __dirname,
              '../fixtures/project/',
              'weirdResolver.js'
            )
          }
        })

        const bundle = await compiler()
        await bundle.generate({})
        callback()
        expect(warnings.length).toBe(0)
        callback()
      }
    )

    ifNodeGte8It('should detect eslints', async callback => {
      const warnings: withRawMessage<RollupWarning>[] = []
      const errors: withRawMessage<RollupError>[] = []

      const { compiler } = createCompiler({
        context: './project_eslint',
        entryPoint: './src/index.ts',
        pluginOptions: {
          eslint: true,
          onWarn: warn => warnings.push(warn),
          onError: err => errors.push(err)
        }
      })

      const bundle = await compiler()
      await bundle.generate({})

      // compiler.run((err, stats) => {
      // const { warnings, errors } = stats.compilation
      expect(warnings.length).toBe(2)

      const [warning, warning2] = warnings
      const actualFile = unixify(warning.loc?.file ?? '')
      const expectedFile = unixify('src/lib/func.ts')
      expect(actualFile).toContain(expectedFile)
      expect(warning.rawMessage).toContain('WARNING')
      expect(warning.rawMessage).toContain('@typescript-eslint/array-type')
      expect(warning.rawMessage).toContain(
        "Array type using 'Array<string>' is forbidden. Use 'string[]' instead."
      )

      // ref: https://codewithhugo.com/jest-array-object-match-contain/
      expect(warning.loc).toEqual(
        expect.objectContaining({
          column: 44,
          line: 3
        })
      )

      const actualFile2 = unixify(warning2.loc?.file ?? '')
      const expectedFile2 = unixify('src/lib/otherFunc.js')
      expect(actualFile2).toContain(expectedFile2)
      expect(warning2.rawMessage).toContain('WARNING')
      expect(warning2.rawMessage).toContain('@typescript-eslint/no-unused-vars')
      expect(warning2.rawMessage).toContain(
        "'i' is assigned a value but never used."
      )
      expect(warning2.loc).toEqual(
        expect.objectContaining({
          column: 5,
          line: 4
        })
      )

      const error = errors.find(err =>
        err.rawMessage.includes('@typescript-eslint/array-type')
      )
      const actualErrorFile = unixify(error?.loc?.file ?? '')
      const expectedErrorFile = unixify('src/index.ts')
      expect(actualErrorFile).toContain(expectedErrorFile)
      expect(error!.rawMessage).toContain('ERROR')
      expect(error!.rawMessage).toContain('@typescript-eslint/array-type')
      expect(error!.rawMessage).toContain(
        "Array type using 'Array<string>' is forbidden. Use 'string[]' instead."
      )
      expect(error!.loc).toEqual(
        expect.objectContaining({
          column: 43,
          line: 5
        })
      )

      callback()
      // })
    })

    ifNodeLt8It(
      'throws an error about Node.js version required for `eslint` option',
      () => {
        expect(() => {
          createCompiler({
            context: './project_eslint',
            entryPoint: '/test/fixtures/project_eslint/src/index.ts',
            pluginOptions: { eslint: true }
          })
        }).toThrowError(
          `To use 'eslint' option, please update to Node.js >= v8.10.0 ` +
            `(current version is ${process.version})`
        )
      }
    )

    it('should block emit on build mode', async callback => {
      const hookStab = {}

      const { compiler } = createCompiler({
        pluginOptions: {
          hookStab
        }
      })

      const bundle = await compiler()
      const forkTsCheckerHooks = ForkTsCheckerWebpackPlugin.getCompilerHooks(
        // @ts-ignore
        hookStab
      )

      forkTsCheckerHooks.emit.tap('should block emit on build mode', () => {
        expect(true).toBe(true)
        callback()
      })

      await bundle.generate({})
    })

    it('should not block emit on watch mode', async callback => {
      const hookStab = {}

      // Use rollup.watch API will not inject variable to env. Manually set it.
      process.env.ROLLUP_WATCH = 'true'

      const { watcher } = createCompiler({
        pluginOptions: {
          hookStab
        }
      })

      const forkTsCheckerHooks = ForkTsCheckerWebpackPlugin.getCompilerHooks(
        // @ts-ignore
        hookStab
      )

      forkTsCheckerHooks.done.tap('should not block emit on watch mode', () => {
        // watching.close(() => {
        _watcher.close()
        expect(true).toBe(true)
        process.env.ROLLUP_WATCH = undefined
        callback()
        // })
      })

      const _watcher = watcher()
    })

    it('should block emit if async flag is false', callback => {
      const hookStab = {}
      // Use rollup.watch API will not inject variable to env. Manually set it.
      process.env.ROLLUP_WATCH = 'true'

      const { watcher } = createCompiler({
        pluginOptions: {
          async: false,
          hookStab
        }
      })

      const forkTsCheckerHooks = ForkTsCheckerWebpackPlugin.getCompilerHooks(
        // @ts-ignore
        hookStab
      )

      forkTsCheckerHooks.emit.tap('should not block emit on watch mode', () => {
        // watching.close(() => {
        _watcher.close()
        expect(true).toBe(true)
        process.env.ROLLUP_WATCH = undefined
        callback()
        // })
      })

      const _watcher = watcher()
    })

    // TODO: how to detect watchClose in rollup?
    xit('kills the service when the watch is done', done => {
      const hookStab = {}

      // Use rollup.watch API will not inject variable to env. Manually set it.
      process.env.ROLLUP_WATCH = 'true'

      const { watcher } = createCompiler({
        pluginOptions: {
          hookStab
        }
      })

      const forkTsCheckerHooks = ForkTsCheckerWebpackPlugin.getCompilerHooks(
        // @ts-ignore
        hookStab
      )

      forkTsCheckerHooks.done.tap('should not block emit on watch mode', () => {
        // watching.close(() => {
        _watcher.close()
        expect(killServiceWasCalled()).toBe(true)
        process.env.ROLLUP_WATCH = undefined
        done()
        // })
      })

      const _watcher = watcher()
    })

    it('should throw error if config container wrong tsconfig.json path', () => {
      expect(async () => {
        const { compiler } = createCompiler({
          pluginOptions: {
            tsconfig: '/some/path/that/not/exists/tsconfig.json'
          }
        })

        const bundle = await compiler()
      }).rejects.toBeTruthy()
    })

    it('should allow delaying service-start', async callback => {
      const hookStab = {}

      const { compiler } = createCompiler({
        pluginOptions: {
          hookStab
        }
      })

      const forkTsCheckerHooks = ForkTsCheckerWebpackPlugin.getCompilerHooks(
        // @ts-ignore
        hookStab
      )

      let delayed = false

      forkTsCheckerHooks.serviceBeforeStart.tapAsync(
        'should allow delaying service-start',
        (cb: () => void) => {
          setTimeout(() => {
            delayed = true

            cb()
          }, 0)
        }
      )

      forkTsCheckerHooks.serviceBeforeStart.tap(
        'should allow delaying service-start',
        () => {
          expect(delayed).toBe(true)
          callback()
        }
      )

      compiler()
    })

    it('should not find syntactic errors when checkSyntacticErrors is false', async callback => {
      const errors: any[] = []
      const { compiler } = createCompiler({
        pluginOptions: {
          checkSyntacticErrors: false,
          onWarn: err => errors.push(err)
        }
        // happyPackMode: true
      })

      const bundle = await compiler()
      await bundle.generate({})

      // compiler.run((_error, stats) => {
      const syntacticErrorNotFoundInStats = errors.every(
        error =>
          !error.rawMessage.includes(
            helpers.expectedErrorCodes.expectedSyntacticErrorCode
          )
      )
      expect(syntacticErrorNotFoundInStats).toBe(true)
      callback()
      // })
    })

    it('should find syntactic errors when checkSyntacticErrors is true', async callback => {
      const errors: any[] = []
      const { compiler } = createCompiler({
        pluginOptions: {
          checkSyntacticErrors: true,
          onError: err => errors.push(err)
        }
        // happyPackMode: true
      })

      const bundle = await compiler()
      await bundle.generate({})

      // compiler.run((_error, stats) => {
      const syntacticErrorFoundInStats = errors.some(error =>
        error.rawMessage.includes(
          helpers.expectedErrorCodes.expectedSyntacticErrorCode
        )
      )
      expect(syntacticErrorFoundInStats).toBe(true)
      callback()
      // })
    })

    /**
     * regression test for #267, #299
     */
    it('should work even when the plugin has been deep-cloned', async callback => {
      const errors: any[] = []

      const { compiler } = createCompiler({
        pluginOptions: {
          tsconfig: 'tsconfig-semantic-error-only.json',
          onError: err => errors.push(err)
        },
        prepareRollupConfig({ plugins, ...config }) {
          return { ...config, plugins: cloneDeep(plugins) }
        }
      })

      const bundle = await compiler()
      await bundle.generate({})

      // compiler.run((err, stats) => {
      expect(errors).toEqual([
        expect.objectContaining({
          message: expect.stringContaining('TS2322')
        })
      ])
      callback()
      // })
    })
  }
)
