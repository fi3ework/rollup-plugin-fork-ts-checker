"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
var ForkTsCheckerWebpackPlugin_1 = require("./ForkTsCheckerWebpackPlugin");
exports.default = (function (options) {
    var forkPlugin = new ForkTsCheckerWebpackPlugin_1.ForkTsCheckerWebpackPlugin(options);
    return {
        name: 'fork-ts-checker-webpack-plugin',
        options: function (inputOptions) {
            var pluginContext = this;
            forkPlugin.options(inputOptions, pluginContext);
            return null;
        },
        buildStart: function (options) {
            return forkPlugin.buildStart(options);
        },
        // @ts-ignore
        generateBundle: function () {
            var pluginContext = this;
            return forkPlugin.generateBundle(pluginContext);
        },
        // pluginStop() {
        // },
        writeBundle: function () {
            return forkPlugin.writeBundle();
        }
    };
});
//# sourceMappingURL=index.js.map