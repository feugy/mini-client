const assert = require('power-assert')
const moment = require('moment')

const invoke = (context, operation, withGroups = true) => {
  if (!withGroups) {
    return context.client[operation]
  }
  return context.client.sample[operation]
}

exports.declareTests = (it, context, withGroups = true) => {
  it('should respond to ping', async () => {
    const result = await invoke(context, 'ping', withGroups)()
    assert(moment(result.time).isValid())
    assert.equal(typeof result.time, 'string')
  })

  it('should expose service\'s version', () => {
    assert.equal(context.client.version, 'sample-service@1.0.0')
  })

  it('should greets people', async () => {
    const result = await invoke(context, 'greeting', withGroups)('Jane')
    assert.equal(result, 'Hello Jane nice to meet you !')
  })

  it('should handle API errors', async () => {
    let res
    try {
      res = await invoke(context, 'failing', withGroups)()
    } catch (err) {
      assert(err instanceof Error)
      assert(err.message.includes('really bad'))
      return
    }
    throw new Error(`unexpected result ${JSON.stringify(res, null, 2)}`)
  })

  it('should validate parameter existence', async () => {
    let res
    try {
      res = await invoke(context, 'greeting', withGroups)()
    } catch (err) {
      assert(err instanceof Error)
      assert(err.message.includes('Incorrect parameters for API greeting'))
      assert(err.message.includes('["name" is required]'))
      return
    }
    throw new Error(`unexpected result ${JSON.stringify(res, null, 2)}`)
  })

  it('should validate parameter type', async () => {
    let res
    try {
      res = await invoke(context, 'greeting', withGroups)(18)
    } catch (err) {
      assert(err instanceof Error)
      assert(err.message.includes('must be a string'))
      return
    }
    throw new Error(`unexpected result ${JSON.stringify(res, null, 2)}`)
  })

  it('should not allows extra parameters', async () => {
    let res
    try {
      res = await invoke(context, 'greeting', withGroups)('Jane', 'Peter')
    } catch (err) {
      assert(err instanceof Error)
      assert(err.message.includes('"1" is not allowed'))
      return
    }
    throw new Error(`unexpected result ${JSON.stringify(res, null, 2)}`)
  })

  it('should handle undefined result', async () => {
    const res = await invoke(context, 'getUndefined', withGroups)()
    assert(res === undefined)
  })
}

// Test when client is local
exports.declareLocaleTests = (it, context, withGroups = true) => {
  it('should handle synchronously failing APIs', async () => {
    let res
    try {
      res = await invoke(context, 'errored', withGroups)()
    } catch (err) {
      assert(err instanceof Error)
      assert(err.message.includes('Error while calling API errored:'))
      assert(err.message.includes('errored API'))
      return
    }
    throw new Error(`unexpected result ${JSON.stringify(res, null, 2)}`)
  })

  it('should propagate Boom errors', async () => {
    let res
    try {
      res = await invoke(context, 'boomError', withGroups)()
    } catch (err) {
      assert(err.isBoom === true)
      assert(err.output.statusCode === 401)
      assert(err.message.includes('Custom authorization error'))
      return
    }
    throw new Error(`unexpected result ${JSON.stringify(res, null, 2)}`)
  })
}
