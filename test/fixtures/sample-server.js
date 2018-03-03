const {Server} = require('hapi')
const Boom = require('boom')
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
    {group: 'sample', id: 'ping', params: [], path: '/api/sample/ping'},
    {group: 'sample-service', id: 'noGroup', params: [], path: '/api/sample-service/no-group'},
    {group: 'sample', id: 'greeting', params: ['name'], path: '/api/sample/greeting'},
    {group: 'sample', id: 'failing', params: [], path: '/api/sample/failing'},
    {group: 'sample', id: 'getUndefined', params: [], path: '/api/sample/get-undefined'},
    {group: 'sample', id: 'noChecksum', params: [], path: '/api/sample/no-checksum'},
    {group: 'sample', id: 'withExoticParameters', params: ['param1', 'param2', 'other'], path: '/api/sample/with-exotic-parameters'}
  ]

  const checksum = crc32(JSON.stringify(apis))

  const {port, logger, groupOpts} = options
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
    path: '/api/sample/ping',
    config: {validate: {}},
    handler: (req, h) => h.response({time: new Date()}).header(checksumHeader, checksum)
  })

  server.route({
    method: 'GET',
    path: '/api/sample-service/no-group',
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
      h.response(`Hello ${req.payload.name}${groupOpts.greetings || ''} !`)
        .header(checksumHeader, checksum)
  })

  server.route({
    method: 'GET',
    path: '/api/sample/failing',
    config: {validate: {}},
    handler: (req, h) => {
      throw new Boom('something went really bad', {statusCode: 599})
    }
  })

  server.route({
    method: 'GET',
    path: '/api/sample/get-undefined',
    handler: (req, h) => h.response(undefined).header(checksumHeader, checksum)
  })

  server.route({
    method: 'POST',
    path: '/api/sample/with-exotic-parameters',
    handler: ({payload: {param1: [a, b], param2: {c: {d}}, other, ...rest}}, h) => {
      return h.response([a, b, d, other, ...Object.keys(rest).map(k => rest[k])])
        .header(checksumHeader, checksum)
    }
  })

  server.route({
    method: 'GET',
    path: '/api/sample/no-checksum',
    config: {validate: {}},
    handler: () => null
  })

  server.route({
    method: 'GET',
    path: '/api/exposed',
    handler: () => ({
      name: 'sample-service',
      version: '1.0.0',
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
