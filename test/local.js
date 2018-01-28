const Lab = require('lab')
const assert = require('power-assert')
const getClient = require('../')
const utils = require('./test-utils')
const {declareTests, declareLocaleTests} = require('./test-suites')

const lab = exports.lab = Lab.script()
const {describe, it, before, after} = lab

describe('mini-client', () => {
  it('should be initialized multiple times', async () => {
    const instance = getClient({name: 'multiple', version: '1.0.0', init: () => ({})})
    await instance.init()
    await instance.init()
  })
})

describe('local client with API group', () => {
  const context = {
    client: getClient({
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
    })
  }

  before(async () => {
    utils.shutdownLogger()
    await context.client.init()
  })

  after(utils.restoreLogger)

  declareTests(it, context)

  declareLocaleTests(it, context)

  it('should synchronously greets people', async () =>
    assert(await context.client.synchronous.greeting('Jane') === 'Hello Jane !')
  )

  it('should validate parameter existence', async () => {
    let res
    try {
      res = await context.client.synchronous.greeting()
    } catch (err) {
      assert(err instanceof Error)
      assert(err.message.includes('Incorrect parameters for API greeting'))
      assert(err.message.includes('["name" is required]'))
      return
    }
    throw new Error(`unexpected result ${JSON.stringify(res, null, 2)}`)
  })

  it('should handle undefined result', async () =>
    assert(await context.client.synchronous.getUndefined() === undefined)
  )

  it('should propagate Boom errors', async () => {
    let res
    try {
      res = await context.client.synchronous.boomError()
    } catch (err) {
      assert(err.isBoom === true)
      assert(err.output.statusCode === 401)
      assert(err.message.includes('Custom authorization error'))
      return
    }
    throw new Error(`unexpected result ${JSON.stringify(res, null, 2)}`)
  })
})
