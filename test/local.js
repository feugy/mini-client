const Lab = require('lab')
const getClient = require('../')
const utils = require('./test-utils')
const {declareTests, declareLocaleTests} = require('./test-suites')

const lab = exports.lab = Lab.script()
const {describe, it, before, after} = lab

describe('mini-client', () => {

  it('should be initialized multiple times', () => {
    const instance = getClient({name: 'multiple', version: '1.0.0', init: () => Promise.resolve({})})
    return instance.init()
      .then(() => instance.init())
  })
})

describe('local client with API group', () => {
  const context = {client: getClient({
    name: 'sample-service',
    version: '1.0.0',
    groups: [{
      name: 'sample',
      init: require('./fixtures/sample')
    }],
    groupOpts: {
      sample: {greetings: ' nice to meet you'}
    }
  })}


  before(() =>
    utils.shutdownLogger()
      .then(() => context.client.init())
  )

  after(utils.restoreLogger)

  declareTests(it, context)

  declareLocaleTests(it, context)
})
