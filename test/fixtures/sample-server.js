const {Server} = require('hapi')
const Boom = require('boom')
const Joi = require('joi')
const crc32 = require('crc32')
const {checksumHeader, getLogger, validateParams} = require('mini-service-utils')

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
module.exports = opts => {
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
    {group: 'sample', id: 'noChecksum', params: [], path: '/api/sample/no-checksum'}
  ]

  const checksum = crc32(JSON.stringify(apis))

  const {port, logger, groupOpts} = options
  logger.debug({port}, 'Configure server')

  const server = new Server()
  server.connection({port})

  server.route({
    method: 'GET',
    path: '/api/sample/ping',
    config: {validate: {}},
    handler: (req, reply) => reply({time: new Date()}).header(checksumHeader, checksum)
  })

  server.route({
    method: 'GET',
    path: '/api/sample-service/no-group',
    config: {validate: {}},
    handler: (req, reply) => reply({time: new Date()}).header(checksumHeader, checksum)
  })

  server.route({
    method: 'POST',
    path: '/api/sample/greeting',
    config: {
      validate: {
        payload: (values, validationOpts, done) =>
          done(validateParams(values, Joi.object({name: Joi.string().required()}), 'greeting', 1))
      }
    },
    handler: (req, reply) =>
      reply(`Hello ${req.payload.name}${groupOpts.greetings || ''} !`)
        .header(checksumHeader, checksum)
  })

  server.route({
    method: 'GET',
    path: '/api/sample/failing',
    config: {validate: {}},
    handler: (req, reply) => reply(Boom.create(599, 'something went really bad'))
  })

  server.route({
    method: 'GET',
    path: '/api/sample/get-undefined',
    handler: (req, reply) => reply(undefined).header(checksumHeader, checksum)
  })

  server.route({
    method: 'GET',
    path: '/api/sample/no-checksum',
    config: {validate: {}},
    handler: (req, reply) => reply()
  })

  server.route({
    method: 'GET',
    path: '/api/exposed',
    handler: (req, reply) => reply({
      name: 'sample-service',
      version: '1.0.0',
      apis
    })
  })

  return server.start()
    .then(() => {
      logger.info(server.info, 'server started')
      return server
    })
    .catch(err => {
      logger.error(err, 'failed to start server')
      throw err
    })
}
