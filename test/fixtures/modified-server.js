const {Server} = require('hapi')
const Joi = require('joi')
const crc32 = require('crc32')
const {checksumHeader, getLogger, enrichError} = require('mini-service-utils')

/**
 * Start Hapi Http server that comply with mini-service conventions
 * It exposes apis from ./fixtures/samples
 *
 * @param {Object} opts - server options, including
 * @param {Number} [opts.port = 3000] - listening port
 * @param {Object} [opts.logger] - bunyan compatible logger
 * @param {Object} [opts.groupOpts] - api configuration
 * @returns {Promise} promise - resolve with the Hapi server as parameter
 */
module.exports = async opts => {
  const options = Object.assign({
    port: 3000,
    logger: getLogger()
  }, opts)

  const apis = [
    {group: 'modified', id: 'ping', params: [], path: '/api/modified/ping'},
    {group: 'sample', id: 'greeting', params: ['name'], path: '/api/sample/greeting'},
    {group: 'sample', id: 'getUndefined', params: [], path: '/api/sample/get-undefined'}
  ]

  const checksum = crc32(JSON.stringify(apis))

  const {port, logger} = options
  logger.debug({port}, 'Configure server')

  const server = new Server({
    port,
    routes: {
      validate: {
        failAction: (r, h, err) => { throw err }
      }
    }
  })

  server.route({
    method: 'GET',
    path: '/api/modified/ping',
    config: {validate: {}},
    handler: (req, h) => h.response({time: new Date()}).header(checksumHeader, checksum)
  })

  server.route({
    method: 'POST',
    path: '/api/sample/greeting',
    config: {
      validate: {
        payload: (values, validationOpts) => {
          const schema = Joi.object({name: Joi.string().required()}).unknown(false)
          const err = enrichError(schema.validate(values).error, 'greeting')
          if (err) {
            throw err
          }
          return values
        }
      }
    },
    handler: (req, h) =>
      h.response(`Hello dear ${req.payload.name} !`).header(checksumHeader, checksum)
  })

  server.route({
    method: 'GET',
    path: '/api/sample/get-undefined',
    handler: (req, h) => h.response(undefined).header(checksumHeader, checksum)
  })

  server.route({
    method: 'GET',
    path: '/api/exposed',
    handler: () => ({
      name: 'sample-service',
      version: '2.0.0',
      apis
    })
  })

  try {
    await server.start()
    logger.info(server.info, 'server started')
    return server
  } catch (err) {
    logger.error(err, 'failed to start server')
    throw err
  }
}
