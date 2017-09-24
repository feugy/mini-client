const Lab = require('lab')
const assert = require('power-assert')
const moment = require('moment')
const bunyan = require('bunyan')
const request = require('request-promise-native')
const getClient = require('../')
const utils = require('./test-utils')
const startServer = require('./fixtures/sample-server')

const lab = exports.lab = Lab.script()
const {describe, it, before, beforeEach, after} = lab

describe('mini-client', () => {

  before(utils.shutdownLogger)

  after(utils.restoreLogger)

  it('should be initialized multiple times', () => {
    const instance = getClient({name: 'multiple', version: '1.0.0', init: () => Promise.resolve({})})
    return instance.init()
      .then(() => instance.init())
  })

  const declareTests = context => {

    it('should respond to ping', () =>
      context.client.ping()
        .then(result => {
          assert(moment(result.time).isValid())
          assert.equal(typeof result.time, 'string')
        })
    )

    it('should expose service\'s version', done => {
      assert.equal(context.client.version, 'sample-service@1.0.0')
      done()
    })

    it('should greets people', () =>
      context.client.greeting('Jane')
        .then(result => {
          assert.equal(result, 'Hello Jane nice to meet you !')
        })
    )

    it('should handle API errors', () =>
      context.client.failing()
        .then(res => {
          assert.fail(res, '', 'unexpected result')
        }, err => {
          assert(err instanceof Error)
          assert(err.message.includes('really bad'))
        })
    )

    it('should validate parameter existence', () =>
      context.client.greeting()
        .then(res => {
          assert.fail(res, '', 'unexpected result')
        }, err => {
          assert(err instanceof Error)
          assert(err.message.includes('Incorrect parameters for API greeting'))
          assert(err.message.includes('["name" is required]'))
        })
    )

    it('should validate parameter type', () =>
      context.client.greeting(18)
        .then(res => {
          assert.fail(res, '', 'unexpected result')
        }, err => {
          assert(err instanceof Error)
          assert(err.message.includes('must be a string'))
        })
    )

    it('should not allows extra parameters', () =>
      context.client.greeting('Jane', 'Peter')
        .then(res => {
          assert.fail(res, '', 'unexpected result')
        }, err => {
          assert(err instanceof Error)
          assert(err.message.includes('must contain at most'))
        })
    )
  }

  // Test when client is local
  const declareLocaleTests = context => {
    it('should handle not compliant APIs', () =>
      context.client.notCompliant()
        .then(res => {
          assert.fail(res, '', 'unexpected result')
        }, err => {
          assert(err instanceof Error)
          assert(err.message.includes('Error while calling API notCompliant:'))
          assert(err.message.includes('.then is not a function'))
        })
    )

    it('should handle synchronously failing APIs', () =>
      context.client.errored()
        .then(res => {
          assert.fail(res, '', 'unexpected result')
        }, err => {
          assert(err instanceof Error)
          assert(err.message.includes('Error while calling API errored:'))
          assert(err.message.includes('errored API'))
        })
    )
  }

  describe('a local client without API group', () => {
    const context = {client: getClient({
      name: 'sample-service',
      version: '1.0.0',
      init: require('./fixtures/sample'),
      greetings: ' nice to meet you'
    })}

    before(() => context.client.init())

    declareTests(context)

    declareLocaleTests(context)
  })

  describe('a local client with API group', () => {
    const context = {client: getClient({
      name: 'sample-service',
      version: '1.0.0',
      groups: [{
        name: 'group1',
        init: require('./fixtures/sample')
      }],
      groupOpts: {
        group1: {greetings: ' nice to meet you'}
      }
    })}

    before(() => context.client.init())

    declareTests(context)

    declareLocaleTests(context)
  })

  describe('a remote client', () => {
    const context = {client: null}
    let server

    before(() =>
      startServer({
        groupOpts: {greetings: ' nice to meet you'}
      })
        .then(serv => {
          server = serv
          context.client = getClient({
            remote: server.info.uri
          })
        })
    )

    after(() => server.stop())

    it('shouldn\'t have version until init or first call ', done => {
      assert.equal(context.client.version, 'unknown')
      done()
    })

    declareTests(context)

    it('should error if remote server has different checksum', () =>
      context.client.pingOutOfSync()
        .then(res => {
          assert.fail(res, '', 'unexpected result')
        }, err => {
          assert(err instanceof Error)
          assert(err.message.includes('isn\'t compatible with current client (expects sample-service@1.0.0)'))
        })
    )

    it('should not add too much overhead', {timeout: 15e3}, () => {

      const benchmark = {
        client: () => context.client.greeting('Jane'),
        direct: () => request({
          method: 'POST',
          uri: `${server.info.uri}/api/sample/greeting`,
          body: {name: 'Jane'},
          json: true
        })
      }
      const run = (name, results, start, duration) => {
        const end = () => {
          if (Date.now() - start >= duration) {
            return Promise.resolve()
          }
          return run(name, results, start, duration)
        }

        return benchmark[name]()
          .then(() => {
            results.count++
            return end()
          })
          .catch(err => {
            results.errored++
            results.errors.push(err)
            return end()
          })
      }

      const runBench = (names, results = {}) => {
        if (names.length === 0) {
          return Promise.resolve(results)
        }
        const name = names.shift()
        results[name] = {count: 0, errored: 0, errors: []}
        // heating run
        return run(name, {count: 0, errored: 0, errors: []}, Date.now(), 1e3)
          // test run
          .then(() => run(name, results[name], Date.now(), 5e3))
          // next bench
          .then(() => runBench(names, results))
      }

      return runBench(Object.keys(benchmark))
        .then(results => {
          const percentage = results.client.count * 100 / results.direct.count
          assert(results.direct.count > 1000)
          assert(results.client.count > 1000)
          assert.equal(results.direct.errored, 0)
          assert.equal(results.client.errored, 0)
          assert(percentage >= 75)
        })
    })
  })

  describe('a remote client without server', () => {
    let remote

    beforeEach(done => {
      remote = getClient({remote: 'http://localhost:3000'})
      done()
    })

    it('should not be detected as a Promise', () =>
      // This will check the existence of then method on the Proxy
      Promise.resolve(remote)
    )

    it('should handle communication error', () =>
      remote.ping() // no server available
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
          remote.ping() // first communication
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
          return remote.ping() // init + ping
            .then(() => remote.ping()) // ping only
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
  })

  describe('local clients with an ordered list of groups', () => {
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
})
