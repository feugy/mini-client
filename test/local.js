const Lab = require('lab')
const assert = require('power-assert')
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
    }, {
      name: 'synchronous',
      init: require('./fixtures/synchronous')
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

  it('should synchronously greets people', () =>
    context.client.synchronous.greeting('Jane')
      .then(result => {
        assert.equal(result, 'Hello Jane !')
      })
  )

  it('should validate parameter existence', () =>
    context.client.synchronous.greeting()
      .then(res => {
        assert.fail(res, '', 'unexpected result')
      }, err => {
        assert(err instanceof Error)
        assert(err.message.includes('Incorrect parameters for API greeting'))
        assert(err.message.includes('["name" is required]'))
      })
  )

  it('should handle undefined result', () =>
    context.client.synchronous.getUndefined()
      .then(res => {
        assert(res === undefined)
      })
  )

  it('should propagate Boom errors', () =>
    context.client.synchronous.boomError()
      .then(() => {
        throw new Error('should have failed')
      }, (err) => {
        assert(err.isBoom === true)
        assert(err.output.statusCode === 401)
        assert(err.message.includes('Custom authorization error'))
      })
  )
})
