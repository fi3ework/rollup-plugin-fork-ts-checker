const mock = require('mock-require')

mock('fork-ts-checker-webpack-plugin/lib/IncrementalChecker', {
  IncrementalChecker: class {
    nextIteration() {
      throw new Error("I'm an error!")
    }
  }
})
