/**
 * Http implementation wired to an Http server.
 *
 * Dependencies:
 * - got@8
 * - crc32@0.2
 * - boom@7
 * - bl@1
 *
 * @module transports/http
 */
const { arrayToObj } = require('mini-service-utils')
const joi = require('joi')
const { computeGroup, makeCompatibilityChecker } = require('../utils')

/**
 * Parse response body as JSON according to content type header
 * @private
 * @param {Object} response - Got response object
 * @returns {*} response body, potentially parsed
 */
const parseIfNeeded = (response, body) =>
  response.headers['content-type'].includes('application/json')
    ? JSON.parse(body)
    : body

/**
 * Http transport options
 * @typedef {Object} HttpOptions
 * @property {Object} transport                 - transport specific options:
 * @property {String} transport.type              - transport type: 'http' in this case
 * @property {String} transport.uri               - http(s) uri to distant service.
 * @property {Number} [transport.timeout = 20000] - HTTP request timeout (ms). Default to a 20 seconds
 * @property {Bunyan} logger                    - logger used for reporting
 */

/**
 * Validates incoming options
 * @param {HttpOptions} options - option hash to validate
 * @throws {Error} when mandatory properties are missing
 * @throws {Error} when property values are misformated
 */
exports.validateOpts = options => {
  // backward compatibility
  // TODO remove on version 5
  const { remote, timeout: oldTimeout } = options
  if (remote !== undefined) {
    options.transport.uri = remote
    process.emitWarning('mini-client: remote option has been deprecated. Use transport.uri instead')
  }
  if (oldTimeout !== undefined) {
    options.transport.timeout = oldTimeout
    process.emitWarning('mini-client: timeout option has been deprecated. Use transport.timeout instead')
  }
  joi.assert(options.transport, joi.object({
    type: joi.string().only('http').required(),
    uri: joi.string().uri().required(),
    timeout: joi.number().integer().positive()
  }).unknown(true).required())
}

/**
 * Fetch Service descriptor from remote service, and register exposed API into the given instance.
 *
 * Mutate mini-client instance to add functions and groups, besides giving value to
 * `version` and `exposed` properties.
 *
 * @async
 * @static
 * @param {Client} client     - mini-client instance in which exposed api will be registered
 * @param {HttpOptions} opts  - mini-client options for http transport
 */
exports.register = async (client, { transport: { uri, timeout = 20e3 }, logger }) => {
  const got = require('got')
  const crc32 = require('crc32')
  const BufferList = require('bl')
  const Boom = require('boom')

  logger.info(`Fetch exposed API from ${uri}`)
  const { body: exposed } = await got(`${uri}/api/exposed`, {
    json: true,
    timeout,
    retry: 0
  })
  // update client version
  client.version = `${exposed.name}@${exposed.version}`
  client.exposed = exposed
  const checksum = crc32(JSON.stringify(exposed.apis))
  // add one method to client per exposed api
  exposed.apis.forEach(({ group, path, id, params, hasStreamInput = false, hasBufferInput = false }) => {
    const serialize = !hasBufferInput && !hasStreamInput
    logger.debug(`API ${id} from ${group} loaded (${client.internalVersion})`)
    const method = params.length ? 'post' : 'get'
    computeGroup(client, group, exposed)[id] = async (...args) => {
      try {
        const response = await new Promise((resolve, reject) => {
          const output = new BufferList()
          got.stream(`${uri}${path}`, {
            method,
            body: serialize ? JSON.stringify(arrayToObj(args, params)) : args[0],
            headers: {
              'content-type': serialize ? 'application/json' : 'application/octet-stream'
            },
            timeout,
            retry: 0
          })
            .on('response', response => {
              response
                .on('end', () => {
                  if (response.headers['content-type'] === 'application/octet-stream') {
                  // keep buffer if required
                    response.body = output.slice()
                  } else if (response.headers['transfer-encoding'] === 'chunked') {
                  // send raw buffer if needed
                    response.body = output
                  } else if (+response.headers['content-length'] !== 0) {
                  // extract data from writable stream, and parse if needed
                    response.body = parseIfNeeded(response, output.toString())
                  }
                  resolve(response)
                })
                .on('error', reject)
                .pipe(output)
            })
            .on('error', (err, body, response) => {
              response
                .on('end', () => {
                  err.body = parseIfNeeded(err, output.toString())
                  reject(err)
                })
                .on('error',
                  // I have no clue how to simulate an error when receiving the error body data
                  /* $lab:coverage:off$ */
                  () => reject(err)
                  /* $lab:coverage:on$ */
                )
                .pipe(output)
            })
            .resume()
        })
        logger.debug({ api: { group, id } }, 'api sucessfully invoked')
        return await checkCompatibility(response, checksum, client, group, id, args, timeout)
      } catch (err) {
        if (err.body) {
          throw new Boom(err.body.message, Object.assign({ statusCode: err.statusCode }, err.body))
        }
        throw err
      }
    }
  })
}

const checkCompatibility = makeCompatibilityChecker(exports.register)
