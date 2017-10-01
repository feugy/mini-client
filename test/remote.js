const Lab = require('lab')
const assert = require('power-assert')
const request = require('request-promise-native')
const moment = require('moment')
const getClient = require('../')
const utils = require('./test-utils')
const {declareTests} = require('./test-suites')
const startServer = require('./fixtures/sample-server')
const startModifiedServer = require('./fixtures/modified-server')

const lab = exports.lab = Lab.script()
const {describe, it, before, after} = lab

describe('remote client', () => {
  const context = {client: null}
  const groupOpts = {greetings: ' nice to meet you'}
  let server

  before(() =>
    utils.shutdownLogger()
      .then(() => startServer({groupOpts}))
      .then(serv => {
        server = serv
        context.client = getClient({
          remote: server.info.uri
        })
      })
  )

  after(() =>
    server.stop()
      .then(utils.restoreLogger)
  )

  it('shouldn\'t have version until init or first call ', done => {
    assert.equal(context.client.version, 'unknown')
    done()
  })

  declareTests(it, context)

  describe('given a remote server change', () => {
    before(() =>
      server.stop()
        .then(() => startModifiedServer())
        .then(serv => {
          server = serv
        })
    )

    after(() =>
      server.stop()
        .then(() => startServer({groupOpts}))
        .then(serv => {
          server = serv
        })
    )

    it('should still invoke modified API with same signature', () =>
      context.client.sample.greeting('Jane')
        .then(res => {
          assert(res === 'Hello dear Jane !')
        })
    )

    it('should still invoke unmodified APIs', () =>
      context.client.sample.getUndefined()
        .then(res => {
          assert(res === undefined)
        })
    )

    it('should invoke new API', () =>
      context.client.modified.ping()
        .then(res => {
          assert(moment(res.time).isValid())
        })
    )

    it('should fail on deleted APIs', () =>
      context.client.sample.ping()
        .then(res => {
          assert.fail(res, '', 'unexpected result')
        }, err => {
          assert(err instanceof Error)
          assert(err.message.includes('isn\'t compatible with current client (expects sample-service@1.0.0)'))
        })
    )
  })

  it('should not add too much overhead', {timeout: 15e3}, () => {
    const benchmark = {
      client: () => context.client.sample.greeting('Jane'),
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
        /* eslint no-console: 0 */
        const percentage = results.client.count * 100 / results.direct.count
        console.log(results)
        console.log(`${percentage}%`)
        assert(results.direct.count > 1000)
        assert(results.client.count > 1000)
        assert.equal(results.direct.errored, 0)
        assert.equal(results.client.errored, 0)
        assert(percentage >= 75)
      })
  })
})
