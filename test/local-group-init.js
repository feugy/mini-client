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
    init: opts => new Promise((resolve, reject) => {
      if (opts.fail) return reject(new Error(`group ${i} failed to initialize`))
      initOrder.push(i)
      opts.logger.info(`from group ${i}`)
      return resolve()
    })
  }))
  const name = 'client'
  const version = '1.0.0'

  beforeEach(done => {
    initOrder.splice(0, initOrder.length)
    done()
  })

  it('should keep order when registering locally', () =>
    getClient({name, version, groups: ordered}).init()
      .then(() => assert.deepEqual(initOrder, [0, 1, 2]))
  )

  it('should stop initialisation at first error', () =>
    getClient({
      name,
      version,
      groups: ordered,
      groupOpts: {
        'group-1': {fail: true}
      }
    }).init()
      .then(res => {
        assert.fail(res, '', 'unexpected result')
      }, err => {
        assert(err instanceof Error)
        assert(err.message.includes('group 1 failed to initialize'))
        assert.deepEqual(initOrder, [0])
      })
  )

  it('should ignore groups that doesn\'t expose an object', () =>
    getClient({
      name,
      version,
      groups: [{
        name: 'init-string',
        init: () => Promise.resolve('initialized')
      }, {
        name: 'init-boolean',
        init: () => Promise.resolve(true)
      }, {
        name: 'init-array',
        init: () => Promise.resolve([{worked: true}])
      }, {
        name: 'init-empty',
        init: () => Promise.resolve(null)
      }].concat(ordered)
    }).init()
  )

  it('should enforce group name', () =>
    getClient({
      name,
      version,
      groups: [{
        init: () => Promise.resolve('initialized')
      }]
    }).init()
      .then(server => {
        server.stop()
        throw new Error('should have failed')
      }, err => {
        assert.ok(err instanceof Error)
        assert(err.message.includes('"name" is required'))
      })
  )

  it('should enforce group init function', () =>
    getClient({
      name,
      version,
      groups: [{
        name: 'test'
      }]
    }).init()
      .then(server => {
        server.stop()
        throw new Error('should have failed')
      }, err => {
        assert.ok(err instanceof Error)
        assert(err.message.includes('"init" is required'))
      })
  )

  it('should enforce client name', done => {
    assert.throws(() => getClient({
      version,
      groups: [{
        name: 'group1',
        init: () => Promise.resolve('initialized')
      }]
    }), /"name" and "version" options/)
    done()
  })

  it('should enforce client version', done => {
    assert.throws(() => getClient({
      name,
      groups: [{
        name: 'group1',
        init: () => Promise.resolve('initialized')
      }]
    }), /"name" and "version" options/)
    done()
  })

  it('should check that group init function returns a Promise', () =>
    getClient({
      name,
      version,
      groups: [{
        name: 'test',
        init: () => ({test: true})
      }]
    }).init()
      .then(server => {
        server.stop()
        throw new Error('should have failed')
      }, err => {
        assert.ok(err instanceof Error)
        assert(err.message.includes('didn\'t returned a promise'))
      })
  )
  it('should expose logger to groups', () => {
    const logs = []
    const logger = bunyan.createLogger({name: 'test'})
    logger.info = msg => logs.push(msg)
    return getClient({
      name,
      version,
      logger,
      groups: ordered
    }).init()
      .then(() => {
        assert.deepEqual(logs, ['from group 0', 'from group 1', 'from group 2'])
      })
  })
})
