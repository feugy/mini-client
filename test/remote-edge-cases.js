const Lab = require('lab')
const assert = require('power-assert')
const moment = require('moment')
const {promisify} = require('util')
const getClient = require('../')
const utils = require('./test-utils')
const startServer = require('./fixtures/sample-server')

const lab = exports.lab = Lab.script()
const {describe, it, before, beforeEach, after, afterEach} = lab
const timer = promisify(setTimeout)

describe('remote client without server', () => {
  let remote
  let server

  before(utils.shutdownLogger)

  after(utils.restoreLogger)

  beforeEach(() => {
    remote = getClient({remote: 'http://localhost:3000'})
    server = null
  })

  afterEach(async () => {
    if (server && server.stop) {
      await server.stop()
    }
  })

  it('should not be detected as a Promise', () =>
    // This will check the existence of then method on the Proxy
    Promise.resolve(remote)
  )

  it('should groups not be detected as a Promise', () =>
    // This will check the existence of then method on the Proxy
    Promise.resolve(remote.unknown)
  )

  it('should handle communication error', async () => {
    let res
    try {
      res = await remote.sample.ping() // no server available
    } catch (err) {
      assert(err instanceof Error)
      assert(err.message.includes('ECONNREFUSED'))
      return
    }
    throw new Error(`unexpected result ${JSON.stringify(res, null, 2)}`)
  })

  it('should configure HTTP timeout', async () => {
    server = await startServer()
    remote = getClient(Object.assign({}, remote.options, {timeout: 1}))
    let res
    try {
      res = await remote.sample.ping()
    } catch (err) {
      assert(err instanceof Error)
      assert(err.message.includes('TIMEDOUT'))
      return
    }
    throw new Error(`unexpected result ${JSON.stringify(res, null, 2)}`)
  })

  it('should not communicate with server until first call', async () => {
    await remote.init() // no communication until that point
    server = await startServer()
    const result = await remote.sample.ping() // first communication
    assert(moment(result.time).isValid())
    assert.equal(typeof result.time, 'string')
  })

  it('should not get remote exposed apis twice', async () => {
    server = await startServer()
    const invoked = []
    server.events.on('response', req => invoked.push(req.route.path))
    // init + ping
    await remote.sample.ping()
    // ping only
    await remote.sample.ping()
    // needed to get the 'response' event
    await timer(10)
    assert.equal(invoked.length, 3)
    assert.equal(invoked.filter(n => n.includes('exposed')).length, 1)
    assert.equal(invoked.filter(n => n.includes('ping')).length, 2)
  })

  it('should report unknown operation', async () => {
    server = await startServer()
    let res
    try {
      // not exposed by server
      res = await remote.unknown()
    } catch (err) {
      assert(err instanceof Error)
      assert(err.message.includes('unknown is not a function'))
      return
    }
    throw new Error(`unexpected result ${JSON.stringify(res, null, 2)}`)
  })

  it('should report unknown group', async () => {
    server = await startServer()
    let res
    try {
      // not exposed by server
      res = await remote.unknown.ping()
    } catch (err) {
      assert(err instanceof Error)
      assert(err.message.includes('Cannot read property \'ping\' of undefined'))
      return
    }
    throw new Error(`unexpected result ${JSON.stringify(res, null, 2)}`)
  })

  it('should report unknown operation within group', async () => {
    server = await startServer()
    let res
    try {
      // not exposed by server
      res = await remote.sample.unknown()
    } catch (err) {
      assert(err instanceof Error)
      assert(err.message.includes('sample.unknown is not a function'))
      return
    }
    throw new Error(`unexpected result ${JSON.stringify(res, null, 2)}`)
  })

  it('should process operation not in groups', async () => {
    server = await startServer()
    const res = await remote.noGroup()
    assert(moment(res).isValid())
    // assert(err instanceof Error)
    // assert(err.message.includes('isn\'t compatible with current client (expects sample-service@1.0.0)'))
  })
})
