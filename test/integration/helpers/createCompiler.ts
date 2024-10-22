// import webpack from 'webpack'
import {
  rollup,
  watch,
  RollupOptions,
  RollupBuild,
  RollupWatcher
} from 'rollup'
import * as path from 'path'
import * as fs from 'fs'
import * as copyDir from 'copy-dir'
import * as rimraf from 'rimraf'
import { ForkTsCheckerWebpackPlugin } from './'
import { Plugin } from './'
import typescript from 'rollup-plugin-typescript2'

if (!beforeAll || !afterAll) {
  throw new Error('file should not be included outside of jest!')
}

const baseTmpDir = path.resolve(__dirname, '../../tmp')
/**
 * parent folder to create all files for integration tests in
 * needs to be a random folder so that jest may execute multiple tests in parallel without conflicts
 * will be set in beforeAll callback
 */
let tmpDirParent: string
let lastInstantiatedPlugin: ForkTsCheckerWebpackPlugin | undefined

beforeAll(function init() {
  if (!fs.existsSync(baseTmpDir)) {
    fs.mkdirSync(baseTmpDir)
  }

  tmpDirParent = fs.mkdtempSync(
    path.join(baseTmpDir, 'fork-ts-checker-webpack-plugin-test')
  )
})

afterAll(function cleanUp() {
  rimraf.sync(tmpDirParent)
})

afterEach(function killPlugin() {
  if (lastInstantiatedPlugin && lastInstantiatedPlugin['service']) {
    lastInstantiatedPlugin['killService']()
  }
})

export interface CreateCompilerOptions {
  entryPoint: string
  context: string
  happyPackMode: boolean
  pluginOptions: Partial<ForkTsCheckerWebpackPlugin.Options>
  prepareRollupConfig(config: RollupOptions): RollupOptions
  nodeRequires: string[]
  normalizeDiagnosticsPaths: boolean
}

const defaultOptions: Partial<ForkTsCheckerWebpackPlugin.Options> = {
  silent: true
}

interface CreateCompilerResults {
  compiler: () => Promise<RollupBuild>
  watcher: () => RollupWatcher
  readonly compilerConfig: RollupOptions
  plugin: ForkTsCheckerWebpackPlugin
  contextDir: string
  outDir: string
  tmpDir: string
}

/**
 * prepares a directory to run an integration test in by
 * * creating a new temporary folder below `tmpDirParent`
 * * copying the contents of the passed `context` directory (relative to ../../fixtures) over
 * * returning the name of the newly created temporary folder
 */
function prepareDirectory({ context }: { context: string }) {
  if (!fs.existsSync(tmpDirParent)) {
    fs.mkdirSync(tmpDirParent)
  }
  const tmpDir = fs.mkdtempSync(path.join(tmpDirParent, 'test'))
  const contextDir = path.resolve(tmpDir, context)
  const outDir = path.resolve(tmpDir, 'out')
  fs.mkdirSync(contextDir)
  fs.mkdirSync(outDir)
  copyDir.sync(path.resolve(__dirname, '../../fixtures/', context), contextDir)
  return { contextDir, outDir, tmpDir }
}

/**
 * removes the "temporary folder" part from all diagnostics' paths and replaces it with "/test-context"
 */
function normalizeDiagnosticsPaths(
  diagnostics: {
    rawMessage: string
    message: string
    file: string
  }[],
  contextDir: string
) {
  contextDir = contextDir.replace(/\/$/, '')
  return diagnostics.map(diagnostic => ({
    ...diagnostic,
    file:
      diagnostic.file && diagnostic.file.replace(contextDir, '/test-context'),
    message:
      diagnostic.message &&
      diagnostic.message.replace(contextDir, '/test-context'),
    rawMessage:
      diagnostic.message &&
      diagnostic.message.replace(contextDir, '/test-context')
  }))
}

export function createCompiler({
  pluginOptions = {},
  // happyPackMode = false,
  entryPoint = './src/index.ts',
  context = './project',
  prepareRollupConfig = config => config,
  nodeRequires = [],
  normalizeDiagnosticsPaths: normalizePaths = true
}: Partial<CreateCompilerOptions> = {}): CreateCompilerResults {
  const { contextDir, outDir, tmpDir } = prepareDirectory({ context })
  entryPoint = path.resolve(contextDir, entryPoint)

  pluginOptions = { ...defaultOptions, ...pluginOptions }

  const internalPlugin = new ForkTsCheckerWebpackPlugin(pluginOptions)
  internalPlugin['nodeArgs'] = nodeRequires.reduce<string[]>(
    (acc, fileName) => {
      acc.push('--require', `${path.resolve(__dirname, fileName)}`)
      return acc
    },
    []
  )
  lastInstantiatedPlugin = internalPlugin

  // @ts-ignore
  const plugin = Plugin(pluginOptions, internalPlugin)
  // const tsLoaderOptions = happyPackMode
  //   ? { happyPackMode: true, silent: true }
  //   : { transpileOnly: true, silent: true }

  const compilerConfig = prepareRollupConfig({
    // mode: 'development',
    context: contextDir,
    input: entryPoint,
    output: { dir: outDir },
    // external: ['fork-ts-checker-webpack-plugin'],
    // resolve: {
    //   extensions: ['.ts', '.js', '.tsx', '.json']
    // },
    // module: {
    //   rules: [
    //     {
    //       test: /\.tsx?$/,
    //       loader: 'ts-loader',
    //       options: tsLoaderOptions
    //     }
    //   ]
    // },
    plugins: [
      // @ts-ignore
      plugin,
      typescript({
        check: false,
        tsconfigOverride: { compilerOptions: { module: 'es2015' } }
      })
    ]
  })

  // const compiler = await rollup(compilerConfig)
  const compiler = () => rollup(compilerConfig)
  const watcher = () =>
    watch({
      ...compilerConfig

      // watch: {
      //   chokidar: {
      //     usePolling: true
      //   }
      // include: ['./src/**'],
      // exclude: ['node_modules/**']
      // }
    })

  // if (normalizePaths) {
  //   const originalRun = compiler.run
  //   rollup(compilerConfig).then(() => {

  //   })

  //   compiler.run = handler => {
  //     originalRun.call(compiler, (error: Error, stats: webpack.Stats) => {
  //       stats.compilation.errors = normalizeDiagnosticsPaths(
  //         stats.compilation.errors,
  //         contextDir
  //       )
  //       stats.compilation.warnings = normalizeDiagnosticsPaths(
  //         stats.compilation.warnings,
  //         contextDir
  //       )
  //       return handler(error, stats)
  //     })
  //   }
  // }

  return {
    compiler,
    watcher,
    // @ts-ignore
    plugin: internalPlugin,
    compilerConfig,
    contextDir,
    outDir,
    tmpDir
  }
}
