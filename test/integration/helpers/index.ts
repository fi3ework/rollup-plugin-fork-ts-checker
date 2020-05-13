import { ForkTsCheckerWebpackPlugin } from '../../../lib/ForkTsCheckerWebpackPlugin'
export { ForkTsCheckerWebpackPlugin }
import Plugin from '../../../lib/index'
export { Plugin }
export { createCompiler, CreateCompilerOptions } from './createCompiler'
// export { createVueCompiler } from './createVueCompiler'
// eslint-disable-next-line @typescript-eslint/ban-ts-ignore
// @ts-ignore
export { getRpcProvider, rpcMethods } from './rpc'

export const expectedErrorCodes = {
  expectedSyntacticErrorCode: 'TS1005',
  expectedSemanticErrorCode: 'TS2322',
  expectedGlobalErrorCode: 'TS1149'
}
