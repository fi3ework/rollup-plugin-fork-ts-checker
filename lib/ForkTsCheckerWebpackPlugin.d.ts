import { InputOptions, PluginContext, MinimalPluginContext } from 'rollup';
import { RpcProvider } from 'worker-rpc';
import { FormatterType, FormatterOptions } from 'fork-ts-checker-webpack-plugin/lib/formatter';
import { VueOptions } from 'fork-ts-checker-webpack-plugin/lib/types/vue-options';
import { Options as EslintOptions } from 'fork-ts-checker-webpack-plugin/lib/types/eslint';
export declare namespace ForkTsCheckerWebpackPlugin {
    interface Logger {
        error(message?: any): void;
        warn(message?: any): void;
        info(message?: any): void;
    }
    interface Options {
        typescript: string;
        tsconfig: string;
        compilerOptions: object;
        eslint: boolean;
        /** Options to supply to eslint https://eslint.org/docs/developer-guide/nodejs-api#cliengine */
        eslintOptions: EslintOptions;
        async: boolean;
        ignoreDiagnostics: number[];
        ignoreLints: string[];
        ignoreLintWarnings: boolean;
        reportFiles: string[];
        logger: Logger;
        formatter: FormatterType;
        formatterOptions: FormatterOptions;
        silent: boolean;
        checkSyntacticErrors: boolean;
        memoryLimit: number;
        vue: boolean | Partial<VueOptions>;
        useTypescriptIncrementalApi: boolean;
        measureCompilationTime: boolean;
        resolveModuleNameModule: string;
        resolveTypeReferenceDirectiveModule: string;
    }
}
/**
 * ForkTsCheckerWebpackPlugin
 * Runs typescript type checker and linter on separate process.
 * This speed-ups build a lot.
 *
 * Options description in README.md
 */
export declare class ForkTsCheckerWebpackPlugin {
    static readonly DEFAULT_MEMORY_LIMIT = 2048;
    static getCompilerHooks(context: PluginContext): Record<import("fork-ts-checker-webpack-plugin/lib/hooks").ForkTsCheckerHooks, import("tapable").SyncHook<any, any, any> | import("tapable").AsyncSeriesHook<any, any, any>>;
    _options: Partial<ForkTsCheckerWebpackPlugin.Options>;
    private tsconfig;
    private compilerOptions;
    private eslint;
    private eslintOptions;
    private ignoreDiagnostics;
    private ignoreLints;
    private ignoreLintWarnings;
    private reportFiles;
    private logger;
    private silent;
    private async;
    private checkSyntacticErrors;
    private memoryLimit;
    private formatter;
    private rawFormatter;
    private useTypescriptIncrementalApi;
    private resolveModuleNameModule;
    private resolveTypeReferenceDirectiveModule;
    private tsconfigPath;
    private compiler;
    private started;
    private elapsed;
    private cancellationToken;
    private isWatching;
    private checkDone;
    private compilationDone;
    private diagnostics;
    private lints;
    private emitCallback;
    private doneCallback;
    private typescriptPath;
    private typescript;
    private typescriptVersion;
    private eslintVersion;
    private service?;
    protected serviceRpc?: RpcProvider;
    private vue;
    private measureTime;
    private performance;
    private startAt;
    protected nodeArgs: string[];
    constructor(options?: Partial<ForkTsCheckerWebpackPlugin.Options>);
    private validateTypeScript;
    private validateEslint;
    private static prepareVueOptions;
    apply(compiler?: any): void;
    private computeContextPath;
    options: (options: InputOptions, pluginContext: MinimalPluginContext) => void;
    buildStart: (options: InputOptions) => void;
    generateBundle: (pluginContext: PluginContext) => Promise<unknown>;
    pluginStop: () => void;
    writeBundle: () => void;
    private spawnService;
    private killService;
    private handleServiceMessage;
    private handleServiceExit;
    private createEmitCallback;
    private createNoopEmitCallback;
    private printLoggerMessage;
    private createDoneCallback;
}
