const Lab = require('lab')
const assert = require('power-assert')
const moment = require('moment')
const getClient = require('../')
const utils = require('./test-utils')
const startServer = require('./fixtures/sample-server')

const lab = exports.lab = Lab.script()
const {describe, it, before, beforeEach, after} = lab

describe('remote client without server', () => {
  let remote

  before(utils.shutdownLogger)

  after(utils.restoreLogger)

  beforeEach(done => {
    remote = getClient({remote: 'http://localhost:3000'})
    done()
  })

  it('should not be detected as a Promise', () =>
    // This will check the existence of then method on the Proxy
    Promise.resolve(remote)
  )

  it('should groups not be detected as a Promise', () =>
    // This will check the existence of then method on the Proxy
    Promise.resolve(remote.unknown)
  )

  it('should handle communication error', () =>
    remote.sample.ping() // no server available
      .then(res => {
        assert.fail(res, '', 'unexpected result')
      }, err => {
        assert(err instanceof Error)
        assert(err.message.includes('ECONNREFUSED'))
      })
  )

  it('should not communicate with server until first call', () =>
    remote.init() // no communication until that point
      .then(() => startServer())
      .then(server =>
        remote.sample.ping() // first communication
          .then(result => {
            server.stop()
            assert(moment(result.time).isValid())
            assert.equal(typeof result.time, 'string')
          }, err => {
            server.stop()
            throw err
          })
      )
  )

  it('should not get remote exposed apis twice', () =>
    startServer()
      .then(server => {
        const invoked = []
        server.on('response', req => invoked.push(req.route.path))
        return remote.sample.ping() // init + ping
          .then(() => remote.sample.ping()) // ping only
          .then(() => new Promise(resolve => setTimeout(resolve, 10))) // needed to get the 'response' event
          .then(() => {
            server.stop()
            assert.equal(invoked.length, 3)
            assert.equal(invoked.filter(n => n.includes('exposed')).length, 1)
            assert.equal(invoked.filter(n => n.includes('ping')).length, 2)
          }, err => {
            server.stop()
            throw err
          })
      })
  )

  it('should report unknown operation', () =>
    startServer()
      .then(server =>
        remote.unknown() // not exposed by server
          .then(res => {
            server.stop()
            assert.fail(res, '', 'unexpected result')
          }, err => {
            server.stop()
            assert(err instanceof Error)
            assert(err.message.includes('unknown is not a function'))
          })
      )
  )

  it('should report unknown group', () =>
    startServer()
      .then(server =>
        remote.unknown.ping() // not exposed by server
          .then(res => {
            server.stop()
            assert.fail(res, '', 'unexpected result')
          }, err => {
            server.stop()
            assert(err instanceof Error)
            assert(err.message.includes('Cannot read property \'ping\' of undefined'))
          })
      )
  )

  it('should report unknown operation within group', () =>
    startServer()
      .then(server =>
        remote.sample.unknown() // not exposed by server
          .then(res => {
            server.stop()
            assert.fail(res, '', 'unexpected result')
          }, err => {
            server.stop()
            assert(err instanceof Error)
            assert(err.message.includes('sample.unknown is not a function'))
          })
      )
  )

  it('should process operation not in groups', () =>
    startServer()
      .then(server =>
        remote.pingOutOfSync() // not exposed by server
          .then(res => {
            server.stop()
            assert.fail(res, '', 'unexpected result')
          }, err => {
            server.stop()
            assert(err instanceof Error)
            assert(err.message.includes('isn\'t compatible with current client (expects sample-service@1.0.0)'))
          })
      )
  )
})
