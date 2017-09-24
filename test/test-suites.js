const assert = require('power-assert')
const moment = require('moment')

const invoke = (context, operation, withGroups = true) => {
  if (!withGroups) {
    return context.client[operation]
  }
  return context.client.sample[operation]
}

exports.declareTests = (it, context, withGroups = true) => {

  it('should respond to ping', () =>
    invoke(context, 'ping', withGroups)()
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
    invoke(context, 'greeting', withGroups)('Jane')
      .then(result => {
        assert.equal(result, 'Hello Jane nice to meet you !')
      })
  )

  it('should handle API errors', () =>
    invoke(context, 'failing', withGroups)()
      .then(res => {
        assert.fail(res, '', 'unexpected result')
      }, err => {
        assert(err instanceof Error)
        assert(err.message.includes('really bad'))
      })
  )

  it('should validate parameter existence', () =>
    invoke(context, 'greeting', withGroups)()
      .then(res => {
        assert.fail(res, '', 'unexpected result')
      }, err => {
        assert(err instanceof Error)
        assert(err.message.includes('Incorrect parameters for API greeting'))
        assert(err.message.includes('["name" is required]'))
      })
  )

  it('should validate parameter type', () =>
    invoke(context, 'greeting', withGroups)(18)
      .then(res => {
        assert.fail(res, '', 'unexpected result')
      }, err => {
        assert(err instanceof Error)
        assert(err.message.includes('must be a string'))
      })
  )

  it('should not allows extra parameters', () =>
    invoke(context, 'greeting', withGroups)('Jane', 'Peter')
      .then(res => {
        assert.fail(res, '', 'unexpected result')
      }, err => {
        assert(err instanceof Error)
        assert(err.message.includes('must contain at most'))
      })
  )
}

// Test when client is local
exports.declareLocaleTests = (it, context, withGroups = true) => {
  it('should handle not compliant APIs', () =>
    invoke(context, 'notCompliant', withGroups)()
      .then(res => {
        assert.fail(res, '', 'unexpected result')
      }, err => {
        assert(err instanceof Error)
        assert(err.message.includes('Error while calling API notCompliant:'))
        assert(err.message.includes('.then is not a function'))
      })
  )

  it('should handle synchronously failing APIs', () =>
    invoke(context, 'errored', withGroups)()
      .then(res => {
        assert.fail(res, '', 'unexpected result')
      }, err => {
        assert(err instanceof Error)
        assert(err.message.includes('Error while calling API errored:'))
        assert(err.message.includes('errored API'))
      })
  )
}
