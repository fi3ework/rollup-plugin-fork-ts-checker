import { InputOptions, PluginContext, MinimalPluginContext } from 'rollup'
import * as path from 'path'
import * as childProcess from 'child_process'
import * as ts from 'typescript'
import * as semver from 'semver'
import chalk from 'chalk'
import micromatch from 'micromatch'
import { RpcProvider } from 'worker-rpc'
import { CancellationToken } from 'fork-ts-checker-webpack-plugin/lib/CancellationToken'
import {
  Formatter,
  createFormatter,
  createRawFormatter,
  FormatterType,
  FormatterOptions
} from 'fork-ts-checker-webpack-plugin/lib/formatter'
import { fileExistsSync } from 'fork-ts-checker-webpack-plugin/lib/FsHelper'
import { Message } from 'fork-ts-checker-webpack-plugin/lib/Message'
import { getForkTsCheckerWebpackPluginHooks } from 'fork-ts-checker-webpack-plugin/lib/hooks'
import {
  RUN,
  RunPayload,
  RunResult
} from 'fork-ts-checker-webpack-plugin/lib/RpcTypes'
import { Issue, IssueSeverity } from 'fork-ts-checker-webpack-plugin/lib/issue'
import { VueOptions } from 'fork-ts-checker-webpack-plugin/lib/types/vue-options'
import { Options as EslintOptions } from 'fork-ts-checker-webpack-plugin/lib/types/eslint'
import { RollupWarning, RollupError } from 'rollup'

export namespace ForkTsCheckerWebpackPlugin {
  export interface Logger {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    error(message?: any): void
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    warn(message?: any): void
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    info(message?: any): void
  }

  export interface Options {
    // this will help getting the hooks instance from internal weak map
    // it's only intended to be used in test case
    hookStab: Object
    onError: (error: withRawMessage<RollupError>) => void
    onWarn: (warning: withRawMessage<RollupWarning>) => void
    /** original options ↓ */
    typescript: string
    tsconfig: string
    compilerOptions: object
    eslint: boolean
    /** Options to supply to eslint https://eslint.org/docs/developer-guide/nodejs-api#cliengine */
    eslintOptions: EslintOptions
    async: boolean
    ignoreDiagnostics: number[]
    ignoreLints: string[]
    ignoreLintWarnings: boolean
    reportFiles: string[]
    logger: Logger
    formatter: FormatterType
    formatterOptions: FormatterOptions
    silent: boolean
    checkSyntacticErrors: boolean
    memoryLimit: number
    vue: boolean | Partial<VueOptions>
    useTypescriptIncrementalApi: boolean
    measureCompilationTime: boolean
    resolveModuleNameModule: string
    resolveTypeReferenceDirectiveModule: string
  }
}

export type withRawMessage<T extends { [k: string]: any }> = T & {
  rawMessage: string
}

/**
 * ForkTsCheckerWebpackPlugin
 * Runs typescript type checker and linter on separate process.
 * This speed-ups build a lot.
 *
 * Options description in README.md
 */
export class ForkTsCheckerWebpackPlugin {
  public static readonly DEFAULT_MEMORY_LIMIT = 2048

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  public static getCompilerHooks(context: PluginContext) {
    return getForkTsCheckerWebpackPluginHooks(context)
  }

  private hookStab?: Object
  private _options: Partial<ForkTsCheckerWebpackPlugin.Options>
  private tsconfig: string
  private compilerOptions: object
  private eslint = false
  private eslintOptions: EslintOptions = {}
  private ignoreDiagnostics: number[]
  private ignoreLints: string[]
  private ignoreLintWarnings: boolean
  private reportFiles: string[]
  private logger: ForkTsCheckerWebpackPlugin.Logger
  private silent: boolean
  private async: boolean
  private checkSyntacticErrors: boolean
  private memoryLimit: number
  private formatter: Formatter
  private rawFormatter!: Formatter
  private useTypescriptIncrementalApi!: boolean
  private resolveModuleNameModule: string | undefined
  private resolveTypeReferenceDirectiveModule: string | undefined

  private tsconfigPath: string | undefined = undefined

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private compiler: any = undefined
  private started: [number, number] | undefined = undefined
  private elapsed: [number, number] | undefined = undefined
  private cancellationToken: CancellationToken | undefined = undefined

  private isWatching = false
  private checkDone = false
  private compilationDone = false
  private diagnostics: Issue[] = []
  private lints: Issue[] = []

  private emitCallback!: () => void
  private doneCallback!: () => void
  private typescriptPath!: string
  private typescript!: typeof ts
  private typescriptVersion!: string
  private eslintVersion: string | undefined = undefined

  private service?: childProcess.ChildProcess
  protected serviceRpc?: RpcProvider

  private vue: VueOptions

  private measureTime!: boolean
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private performance: any
  private startAt = 0

  protected nodeArgs: string[] = []

  constructor(options?: Partial<ForkTsCheckerWebpackPlugin.Options>) {
    options = options || ({} as ForkTsCheckerWebpackPlugin.Options)
    this._options = { ...options }
    this.hookStab = options.hookStab
    this.ignoreDiagnostics = options.ignoreDiagnostics || []
    this.ignoreLints = options.ignoreLints || []
    this.ignoreLintWarnings = options.ignoreLintWarnings === true
    this.reportFiles = options.reportFiles || []
    this.logger = options.logger || console
    this.silent = options.silent === true // default false
    this.async = options.async !== false // default true
    this.checkSyntacticErrors = options.checkSyntacticErrors === true // default false
    this.resolveModuleNameModule = options.resolveModuleNameModule
    this.resolveTypeReferenceDirectiveModule =
      options.resolveTypeReferenceDirectiveModule
    this.memoryLimit =
      options.memoryLimit || ForkTsCheckerWebpackPlugin.DEFAULT_MEMORY_LIMIT
    this.formatter = createFormatter(
      options.formatter,
      options.formatterOptions
    )
    this.rawFormatter = createRawFormatter()
    this.emitCallback = this.createNoopEmitCallback()
    this.doneCallback = this.createDoneCallback()
    const {
      typescript,
      typescriptPath,
      typescriptVersion,
      tsconfig,
      compilerOptions
    } = this.validateTypeScript(options)
    this.typescript = typescript
    this.typescriptPath = typescriptPath
    this.typescriptVersion = typescriptVersion
    this.tsconfig = tsconfig
    this.compilerOptions = compilerOptions
    if (options.eslint === true) {
      const { eslintVersion, eslintOptions } = this.validateEslint(options)
      this.eslint = true
      this.eslintVersion = eslintVersion
      this.eslintOptions = eslintOptions
    }
    this.vue = ForkTsCheckerWebpackPlugin.prepareVueOptions(options.vue)
    this.useTypescriptIncrementalApi =
      options.useTypescriptIncrementalApi === undefined
        ? semver.gte(this.typescriptVersion, '3.0.0') && !this.vue.enabled
        : options.useTypescriptIncrementalApi
    this.measureTime = options.measureCompilationTime === true
    if (this.measureTime) {
      if (semver.lt(process.version, '8.5.0')) {
        throw new Error(
          `To use 'measureCompilationTime' option, please update to Node.js >= v8.5.0 ` +
            `(current version is ${process.version})`
        )
      }
      // Node 8+ only
      // eslint-disable-next-line node/no-unsupported-features/node-builtins
      this.performance = require('perf_hooks').performance
    }

    // this.apply('')
  }

  private validateTypeScript(
    options: Partial<ForkTsCheckerWebpackPlugin.Options>
  ) {
    const typescriptPath = options.typescript || require.resolve('typescript')
    const tsconfig = options.tsconfig || './tsconfig.json'
    const compilerOptions =
      typeof options.compilerOptions === 'object' ? options.compilerOptions : {}

    let typescript, typescriptVersion

    try {
      typescript = require(typescriptPath)
      typescriptVersion = typescript.version
    } catch (_ignored) {
      throw new Error('When you use this plugin you must install `typescript`.')
    }

    if (semver.lt(typescriptVersion, '2.1.0')) {
      throw new Error(
        `Cannot use current typescript version of ${typescriptVersion}, the minimum required version is 2.1.0`
      )
    }

    return {
      typescriptPath,
      typescript,
      typescriptVersion,
      tsconfig,
      compilerOptions
    }
  }

  private getCompiler = () => {
    // fork-ts-checker-webpack plugin use compiler to be the key of each hook object
    // we use the inputOptions from options hook as an alternative in Rollup
    return this.hookStab || this.compiler // not a compiler, it's `options`. But keep this name for now.
  }

  private validateEslint(options: Partial<ForkTsCheckerWebpackPlugin.Options>) {
    let eslintVersion: string
    const eslintOptions =
      typeof options.eslintOptions === 'object' ? options.eslintOptions : {}

    if (semver.lt(process.version, '8.10.0')) {
      throw new Error(
        `To use 'eslint' option, please update to Node.js >= v8.10.0 ` +
          `(current version is ${process.version})`
      )
    }

    try {
      eslintVersion = require('eslint').Linter.version
    } catch (error) {
      throw new Error(
        `When you use 'eslint' option, make sure to install 'eslint'.`
      )
    }

    return { eslintVersion, eslintOptions }
  }

  private static prepareVueOptions(
    vueOptions?: boolean | Partial<VueOptions>
  ): VueOptions {
    const defaultVueOptions: VueOptions = {
      compiler: 'vue-template-compiler',
      enabled: false
    }

    if (typeof vueOptions === 'boolean') {
      return Object.assign(defaultVueOptions, { enabled: vueOptions })
    } else if (typeof vueOptions === 'object' && vueOptions !== null) {
      return Object.assign(defaultVueOptions, vueOptions)
    } else {
      return defaultVueOptions
    }
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  public apply() {
    // add to map
    ForkTsCheckerWebpackPlugin.getCompilerHooks(this.getCompiler())

    this.tsconfigPath = this.computeContextPath(this.tsconfig)

    // validate config
    const tsconfigOk = fileExistsSync(this.tsconfigPath)

    // validate logger
    if (this.logger) {
      if (!this.logger.error || !this.logger.warn || !this.logger.info) {
        throw new Error(
          "Invalid logger object - doesn't provide `error`, `warn` or `info` method."
        )
      }
    }

    if (!tsconfigOk) {
      throw new Error(
        'Cannot find "' +
          this.tsconfigPath +
          '" file. Please check webpack and ForkTsCheckerWebpackPlugin configuration. \n' +
          'Possible errors: \n' +
          '  - wrong `context` directory in webpack configuration' +
          ' (if `tsconfig` is not set or is a relative path in fork plugin configuration)\n' +
          '  - wrong `tsconfig` path in fork plugin configuration' +
          ' (should be a relative or absolute path)'
      )
    }

    // this.pluginStart(); // -> options
    this.pluginStop() // -> pluginStop (exit process) & writeBundle(after emit done)
    // this.pluginCompile(); // -> buildStart
    // this.pluginDone(); // -> buildEnd
    // this.pluginEmit(); // -> generateBundle
  }

  private computeContextPath(filePath: string) {
    return path.isAbsolute(filePath)
      ? filePath
      : // : path.resolve(process.cwd(), filePath)
        path.resolve(this.compiler.options.context || process.cwd(), filePath)
  }

  // TODO: consider multiple entry?
  public options = (inputOptions: InputOptions) => {
    this.compiler = { options: inputOptions }
    this.isWatching =
      // run by rollup.watch() and provide watch options
      !!inputOptions.watch ||
      // run by cli options -W
      process.env.ROLLUP_WATCH === 'true' ||
      // assuming will be watched under development mode
      process.env.NODE_ENV === 'development'
    this.apply()
  }

  public buildStart = (options: InputOptions): void => {
    const forkTsCheckerHooks = ForkTsCheckerWebpackPlugin.getCompilerHooks(
      this.getCompiler()
    )

    this.compilationDone = false
    forkTsCheckerHooks.serviceBeforeStart.callAsync(() => {
      if (this.cancellationToken) {
        // request cancellation if there is not finished job
        this.cancellationToken.requestCancellation()
        forkTsCheckerHooks.cancel.call(this.cancellationToken)
      }
      this.checkDone = false

      this.started = process.hrtime()

      // create new token for current job
      this.cancellationToken = new CancellationToken(this.typescript)
      if (!this.service || !this.service.connected) {
        this.spawnService()
      }

      try {
        if (this.measureTime) {
          this.startAt = this.performance.now()
        }
        // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
        this.serviceRpc!.rpc<RunPayload, RunResult>(
          RUN,
          this.cancellationToken.toJSON()
        ).then(result => {
          if (result) {
            this.handleServiceMessage(result)
          }
        })
      } catch (error) {
        if (!this.silent && this.logger) {
          this.logger.error(
            chalk.red(
              'Cannot start checker service: ' +
                (error ? error.toString() : 'Unknown error')
            )
          )
        }

        forkTsCheckerHooks.serviceStartError.call(error)
      }
    })
  }

  public generateBundle = (pluginContext: PluginContext) => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return new Promise((resolve, reject) => {
      const emit = (compilation: any, callback: () => void) => {
        if (this.isWatching && this.async) {
          resolve()
          // callback();
          return
        }

        // this.emitCallback = this.createEmitCallback(compilation, callback);
        this.emitCallback = this.createEmitCallback(pluginContext, resolve, {
          onWarn: this._options.onWarn,
          onError: this._options.onError
        })

        if (this.checkDone) {
          this.emitCallback()
        }

        this.compilationDone = true
      }

      emit({}, () => {})
    })

    // this.compiler.hooks.emit.tapAsync(checkerPluginName, emit);
  }

  public pluginStop = () => {
    // NOTE: a workaround, rollup doesn't provide an `watchend` event
    process.on('SIGINT', () => {
      this.killService()
      process.exit()
    })

    process.on('exit', () => {
      this.killService()
    })
  }

  public buildEnd = () => {
    const forkTsCheckerHooks = ForkTsCheckerWebpackPlugin.getCompilerHooks(
      this.getCompiler()
    )
    // this.compiler.hooks.done.tap(checkerPluginName, () => {
    if (!this.isWatching || !this.async) {
      return
    }

    if (this.checkDone) {
      this.doneCallback()
    } else {
      if (this.compiler) {
        forkTsCheckerHooks.waiting.call()
      }
      if (!this.silent && this.logger) {
        this.logger.info('Type checking in progress...')
      }
    }

    this.compilationDone = true
    // });
  }

  public writeBundle = async () => {
    // how to detect watchClose in rollup?
    // const watchClose = () => {
    //   this.killService()
    // }

    const done = () => {
      if (!this.isWatching) {
        this.killService()
      }
    }

    done()
  }

  private spawnService() {
    const env: { [key: string]: string | undefined } = {
      ...process.env,
      TYPESCRIPT_PATH: this.typescriptPath,
      TSCONFIG: this.tsconfigPath,
      COMPILER_OPTIONS: JSON.stringify(this.compilerOptions),
      CONTEXT: this.compiler?.options?.context,
      ESLINT: String(this.eslint),
      ESLINT_OPTIONS: JSON.stringify(this.eslintOptions),
      MEMORY_LIMIT: String(this.memoryLimit),
      CHECK_SYNTACTIC_ERRORS: String(this.checkSyntacticErrors),
      USE_INCREMENTAL_API: String(this.useTypescriptIncrementalApi === true),
      VUE: JSON.stringify(this.vue)
    }

    if (typeof this.resolveModuleNameModule !== 'undefined') {
      env.RESOLVE_MODULE_NAME = this.resolveModuleNameModule
    } else {
      delete env.RESOLVE_MODULE_NAME
    }

    if (typeof this.resolveTypeReferenceDirectiveModule !== 'undefined') {
      env.RESOLVE_TYPE_REFERENCE_DIRECTIVE = this.resolveTypeReferenceDirectiveModule
    } else {
      delete env.RESOLVE_TYPE_REFERENCE_DIRECTIVE
    }

    this.service = childProcess.fork(
      require.resolve('fork-ts-checker-webpack-plugin/lib/service.js'),
      // path.resolve(__dirname, './service.js'),
      [],
      {
        env,
        execArgv: ['--max-old-space-size=' + this.memoryLimit].concat(
          this.nodeArgs
        ),
        stdio: ['inherit', 'inherit', 'inherit', 'ipc']
      }
    )

    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
    this.serviceRpc = new RpcProvider(message => this.service!.send(message))
    this.service.on('message', message => {
      if (this.serviceRpc) {
        // ensure that serviceRpc is defined to avoid race-conditions
        this.serviceRpc.dispatch(message)
      }
    })

    const forkTsCheckerHooks = ForkTsCheckerWebpackPlugin.getCompilerHooks(
      this.getCompiler()
    )
    forkTsCheckerHooks.serviceStart.call(this.tsconfigPath, this.memoryLimit)

    if (!this.silent && this.logger) {
      this.logger.info('Starting type checking service...')
    }

    this.service.on('exit', (code: string | number, signal: string) =>
      this.handleServiceExit(code, signal)
    )
  }

  private killService() {
    if (!this.service) {
      return
    }
    try {
      if (this.cancellationToken) {
        this.cancellationToken.cleanupCancellation()
      }

      // clean-up listeners
      this.service.removeAllListeners()
      this.service.kill()
      this.service = undefined
      this.serviceRpc = undefined
    } catch (e) {
      if (this.logger && !this.silent) {
        this.logger.error(e)
      }
    }
  }

  private handleServiceMessage(message: Message): void {
    if (this.measureTime) {
      const delta = this.performance.now() - this.startAt
      const deltaRounded = Math.round(delta * 100) / 100
      this.logger.info(`Compilation took: ${deltaRounded} ms.`)
    }
    if (this.cancellationToken) {
      this.cancellationToken.cleanupCancellation()
      // job is done - nothing to cancel
      this.cancellationToken = undefined
    }

    this.checkDone = true
    this.elapsed = process.hrtime(this.started)
    this.diagnostics = message.diagnostics
    this.lints = message.lints

    if (this.ignoreDiagnostics.length) {
      this.diagnostics = this.diagnostics.filter(
        diagnostic =>
          !this.ignoreDiagnostics.includes(
            parseInt(diagnostic.code as string, 10)
          )
      )
    }

    if (this.ignoreLints.length) {
      this.lints = this.lints.filter(
        lint => !this.ignoreLints.includes(lint.code as string)
      )
    }

    if (this.reportFiles.length) {
      const reportFilesPredicate = (issue: Issue): boolean => {
        if (issue.file) {
          const relativeFileName = path.relative(
            this.compiler.options.context,
            issue.file
          )
          const matchResult = micromatch([relativeFileName], this.reportFiles)

          if (matchResult.length === 0) {
            return false
          }
        }
        return true
      }

      this.diagnostics = this.diagnostics.filter(reportFilesPredicate)
      this.lints = this.lints.filter(reportFilesPredicate)
    }

    const forkTsCheckerHooks = ForkTsCheckerWebpackPlugin.getCompilerHooks(
      this.getCompiler()
    )
    forkTsCheckerHooks.receive.call(this.diagnostics, this.lints)

    if (this.compilationDone) {
      this.isWatching && this.async ? this.doneCallback() : this.emitCallback()
    }
  }

  private handleServiceExit(_code: string | number, signal: string) {
    if (signal !== 'SIGABRT' && signal !== 'SIGINT') {
      return
    }
    // probably out of memory :/
    if (this.compiler) {
      const forkTsCheckerHooks = ForkTsCheckerWebpackPlugin.getCompilerHooks(
        this.getCompiler()
      )
      forkTsCheckerHooks.serviceOutOfMemory.call()
    }
    if (!this.silent && this.logger) {
      if (signal === 'SIGINT') {
        this.logger.error(
          chalk.red(
            'Type checking and linting interrupted - If running in a docker container, this may be caused ' +
              "by the container running out of memory. If so, try increasing the container's memory limit " +
              'or lowering the memoryLimit value in the ForkTsCheckerWebpackPlugin configuration.'
          )
        )
      } else {
        this.logger.error(
          chalk.red(
            'Type checking and linting aborted - probably out of memory. ' +
              'Check `memoryLimit` option in ForkTsCheckerWebpackPlugin configuration.'
          )
        )
      }
    }
  }

  private createEmitCallback(
    pluginContext: PluginContext,
    callback: () => void,
    onWarnOrError?: {
      onWarn?: ForkTsCheckerWebpackPlugin.Options['onWarn']
      onError?: ForkTsCheckerWebpackPlugin.Options['onError']
    }
  ) {
    return function emitCallback(this: ForkTsCheckerWebpackPlugin) {
      if (!this.elapsed) {
        throw new Error('Execution order error')
      }
      const elapsed = Math.round(this.elapsed[0] * 1e9 + this.elapsed[1])

      const forkTsCheckerHooks = ForkTsCheckerWebpackPlugin.getCompilerHooks(
        this.getCompiler()
      )
      forkTsCheckerHooks.emit.call(this.diagnostics, this.lints, elapsed)
      this.diagnostics.concat(this.lints).forEach(issue => {
        // const warning = diagnosticToWarning(ts, host, diagnostic);
        // rollup message format
        const formatted: withRawMessage<RollupWarning | RollupError> = {
          plugin: 'fork-ts-checker-webpack-plugin',
          rawMessage: this.rawFormatter(issue),
          message: this.formatter(issue),
          loc: {
            file: issue.file,
            line: issue.line ?? -1, // TODO:
            column: issue.character ?? -1 // TODO:
          }
        }

        if (issue.severity === IssueSeverity.WARNING) {
          if (!this.ignoreLintWarnings) {
            pluginContext.warn(formatted)
            onWarnOrError?.onWarn?.(formatted)
          }
        } else {
          pluginContext.warn(formatted)
          onWarnOrError?.onError?.(formatted)
        }
      })

      callback()
    }
  }

  private createNoopEmitCallback() {
    // this function is empty intentionally
    // eslint-disable-next-line @typescript-eslint/no-empty-function
    return function noopEmitCallback() {}
  }

  private printLoggerMessage(issue: Issue, formattedIssue: string): void {
    if (issue.severity === IssueSeverity.WARNING) {
      if (this.ignoreLintWarnings) {
        return
      }
      this.logger.warn(formattedIssue)
    } else {
      this.logger.error(formattedIssue)
    }
  }

  private createDoneCallback() {
    return function doneCallback(this: ForkTsCheckerWebpackPlugin) {
      if (!this.elapsed) {
        throw new Error('Execution order error')
      }
      const elapsed = Math.round(this.elapsed[0] * 1e9 + this.elapsed[1])

      if (this.compiler) {
        const forkTsCheckerHooks = ForkTsCheckerWebpackPlugin.getCompilerHooks(
          this.getCompiler()
        )
        forkTsCheckerHooks.done.call(this.diagnostics, this.lints, elapsed)
      }

      if (!this.silent && this.logger) {
        if (this.diagnostics.length || this.lints.length) {
          ;(this.lints || []).concat(this.diagnostics).forEach(diagnostic => {
            const formattedDiagnostic = this.formatter(diagnostic)

            this.printLoggerMessage(diagnostic, formattedDiagnostic)
          })
        }
        if (!this.diagnostics.length) {
          this.logger.info(chalk.green('No type errors found'))
        }
        this.logger.info(
          'Version: typescript ' +
            chalk.bold(this.typescriptVersion) +
            (this.eslint
              ? ', eslint ' + chalk.bold(this.eslintVersion as string)
              : '')
        )
        this.logger.info(
          `Time: ${chalk.bold(Math.round(elapsed / 1e6).toString())} ms`
        )
      }
    }
  }
}
