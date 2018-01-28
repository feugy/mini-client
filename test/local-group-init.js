const Lab = require('lab')
const assert = require('power-assert')
const bunyan = require('bunyan')
const getClient = require('../')
const utils = require('./test-utils')

const lab = exports.lab = Lab.script()
const {describe, it, before, beforeEach, after} = lab

describe('local clients with an ordered list of groups', () => {
  before(utils.shutdownLogger)

  after(utils.restoreLogger)

  const initOrder = []
  const ordered = Array.from({length: 3}).map((v, i) => ({
    name: `group-${i}`,
    init: async opts => {
      if (opts.fail) throw new Error(`group ${i} failed to initialize`)
      initOrder.push(i)
      opts.logger.info(`from group ${i}`)
    }
  }))
  const name = 'client'
  const version = '1.0.0'

  beforeEach(() =>
    initOrder.splice(0, initOrder.length)
  )

  it('should keep order when registering locally', async () => {
    await getClient({name, version, groups: ordered}).init()
    assert.deepEqual(initOrder, [0, 1, 2])
  })

  it('should stop initialisation at first error', async () => {
    let res
    try {
      res = await getClient({
        name,
        version,
        groups: ordered,
        groupOpts: {
          'group-1': {fail: true}
        }
      }).init()
    } catch (err) {
      assert(err instanceof Error)
      assert(err.message.includes('group 1 failed to initialize'))
      assert.deepEqual(initOrder, [0])
      return
    }
    throw new Error(`unexpected result ${JSON.stringify(res, null, 2)}`)
  })

  it('should ignore groups that doesn\'t expose an object', async () =>
    getClient({
      name,
      version,
      groups: [{
        name: 'init-string',
        init: async () => 'initialized'
      }, {
        name: 'init-boolean',
        init: async () => true
      }, {
        name: 'init-array',
        init: async () => [{worked: true}]
      }, {
        name: 'init-empty',
        init: async () => null
      }].concat(ordered)
    }).init()
  )

  it('should enforce group name', async () => {
    try {
      const server = await getClient({
        name,
        version,
        groups: [{
          init: async () => 'initialized'
        }]
      }).init()
      await server.stop()
    } catch (err) {
      assert.ok(err instanceof Error)
      assert(err.message.includes('"name" is required'))
      return
    }
    throw new Error('should have failed')
  })

  it('should enforce group init function', async () => {
    try {
      const server = await getClient({
        name,
        version,
        groups: [{
          name: 'test'
        }]
      }).init()
      await server.stop()
    } catch (err) {
      assert.ok(err instanceof Error)
      assert(err.message.includes('"init" is required'))
      return
    }
    throw new Error('should have failed')
  })

  it('should enforce client name', () => {
    assert.throws(() => getClient({
      version,
      groups: [{
        name: 'group1',
        init: () => 'initialized'
      }]
    }), /"name" and "version" options/)
  })

  it('should enforce client version', () => {
    assert.throws(() => getClient({
      name,
      groups: [{
        name: 'group1',
        init: () => 'initialized'
      }]
    }), /"name" and "version" options/)
  })

  it('should expose logger to groups', async () => {
    const logs = []
    const logger = bunyan.createLogger({name: 'test'})
    logger.info = msg => logs.push(msg)
    await getClient({
      name,
      version,
      logger,
      groups: ordered
    }).init()
    assert.deepEqual(logs, ['from group 0', 'from group 1', 'from group 2'])
  })
})
