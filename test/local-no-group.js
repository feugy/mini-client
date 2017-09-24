const Lab = require('lab')
const getClient = require('../')
const utils = require('./test-utils')
const {declareTests, declareLocaleTests} = require('./test-suites')

const lab = exports.lab = Lab.script()
const {describe, it, before, after} = lab

describe('local client without API group', () => {
  const context = {client: getClient({
    name: 'sample-service',
    version: '1.0.0',
    init: require('./fixtures/sample'),
    greetings: ' nice to meet you'
  })}

  before(() =>
    utils.shutdownLogger()
      .then(() =>  context.client.init())
  )

  after(utils.restoreLogger)

  declareTests(it, context, false)

  declareLocaleTests(it, context, false)
})
