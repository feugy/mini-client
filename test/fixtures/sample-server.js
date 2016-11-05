const {Server} = require('hapi')
const Boom = require('boom')
const Joi = require('joi')
const {getLogger, validateParams} = require('../../lib/utils')

/**
 * Start Hapi Http server that comply with mini-service conventions
 * It exposes apis from ./fixtures/samples
 *
 * @param {Object} opts - server options, including
 * @param {Number} [opts.port = 3000] - listening port
 * @param {Object} [opts.logger] - bunyan compatible logger
 * @param {Object} [opts.serviceOpts] - api configuration
 * @returns {Promise} promise - resolve with the Hapi server as parameter
 */
module.exports = opts => {
  const options = Object.assign({
    port: 3000,
    logger: getLogger()
  }, opts)

  const {port, logger, serviceOpts} = options
  logger.debug({port}, 'Configure server')

  const server = new Server()
  server.connection({port})

  server.route({
    method: 'GET',
    path: '/api/sample/ping',
    config: {validate: {}},
    handler: (req, reply) => reply({time: new Date()})
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
    handler: (req, reply) => reply(`Hello ${req.payload.name}${serviceOpts.greetings || ''} !`)
  })

  server.route({
    method: 'GET',
    path: '/api/sample/failing',
    config: {validate: {}},
    handler: (req, reply) => reply(Boom.create(599, 'something went really bad'))
  })

  server.route({
    method: 'GET',
    path: '/api/exposed',
    handler: (req, reply) => reply({
      name: 'sample-service',
      version: '1.0.0',
      apis: [
        {name: 'sample', id: 'ping', params: [], path: '/api/sample/ping'},
        {name: 'sample', id: 'greeting', params: ['name'], path: '/api/sample/greeting'},
        {name: 'sample', id: 'failing', params: [], path: '/api/sample/failing'}
      ]
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
