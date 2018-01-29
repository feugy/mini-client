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

  before(async () => {
    utils.shutdownLogger()
    server = await startServer({groupOpts})
    context.client = getClient({
      remote: server.info.uri
    })
  })

  after(async () => {
    await server.stop()
    utils.restoreLogger()
  })

  it('shouldn\'t have version until init or first call', () => {
    assert.equal(context.client.version, 'unknown')
  })

  declareTests(it, context)

  it('should fail if non checksum can be found', async () => {
    let res
    try {
      res = await context.client.sample.noChecksum()
    } catch (err) {
      assert(err instanceof Error)
      assert(err.message.includes('Couldn\'t find checksum'))
      return
    }
    throw new Error(`unexpected result ${JSON.stringify(res, null, 2)}`)
  })

  describe('given a remote server change', () => {
    before(async () => {
      await server.stop()
      server = await startModifiedServer()
    })

    after(async () => {
      await server.stop()
      server = await startServer({groupOpts})
    })

    it('should still invoke modified API with same signature', async () =>
      assert(await context.client.sample.greeting('Jane') === 'Hello dear Jane !')
    )

    it('should still invoke unmodified APIs', async () =>
      assert(await context.client.sample.getUndefined() === undefined)
    )

    it('should invoke new API', async () =>
      assert(moment((await context.client.modified.ping()).time).isValid())
    )

    it('should fail on deleted APIs', async () => {
      let res
      try {
        res = await context.client.sample.ping()
      } catch (err) {
        assert(err instanceof Error)
        assert(err.message.includes('isn\'t compatible with current client (expects sample-service@1.0.0)'))
        return
      }
      throw new Error(`unexpected result ${JSON.stringify(res, null, 2)}`)
    })
  })

  it('should not add too much overhead', {timeout: 15e3}, async () => {
    const benchmark = {
      client: async () => context.client.sample.greeting('Jane'),
      direct: async () => request({
        method: 'POST',
        uri: `${server.info.uri}/api/sample/greeting`,
        body: {name: 'Jane'},
        json: true
      })
    }

    const run = async (name, results, start, duration) => {
      try {
        await benchmark[name]()
        results.count++
      } catch (err) {
        results.errored++
        results.errors.push(err)
      }
      if (Date.now() - start >= duration) {
        return
      }
      await run(name, results, start, duration)
    }

    const runBench = async (names, results = {}) => {
      if (names.length === 0) {
        return results
      }
      const name = names.shift()
      results[name] = {count: 0, errored: 0, errors: []}
      // heating run
      await run(name, {count: 0, errored: 0, errors: []}, Date.now(), 1e3)
      // test run
      await run(name, results[name], Date.now(), 5e3)
      // next bench
      return runBench(names, results)
    }

    const results = await runBench(Object.keys(benchmark))
    /* eslint no-console: 0 */
    const percentage = Math.round(results.client.count * 1000 / results.direct.count) / 10
    console.log(results)
    console.log(`${percentage}%`)
    assert(results.direct.count > 1000)
    assert(results.client.count > 1000)
    assert.equal(results.direct.errored, 0)
    assert.equal(results.client.errored, 0)
    assert(percentage >= 75)
  })
})
