const request = require('request-promise')
const joi = require('joi')
const {getParamNames, arrayToObj, validateParams, isApi}= require('./utils')

// expected schema for exposed services
const serviceschema = joi.array().items(joi.object({
  name: joi.string().required(),
  init: joi.func().required()
}).unknown(true))

/**
 * Ask a given server for apis to register into the given context
 *
 * @param {Object} client - in which services exposed api will be registered
 * @param {String} url - remote server that exposes the APIs
 * @param {Bunyan} logger - logger used to report init
 * @returns {Promise} promise - resolve without argument when all service apis have been exposed into context
 */
exports.registerFromServer = (client, url, logger) =>
  request({
    method: 'GET',
    uri: `${url}/api/exposed`,
    json: true
  }).then(exposed => {
    // update client version
    client.options.version = `${exposed.name}@${exposed.version}`
    // add one method to client per exposed api
    exposed.apis.forEach(({name, path, id, params}) => {
      const method = params.length ? 'POST' : 'GET'
      client[id] = (...args) =>
        request({
          method,
          uri: `${url}${path}`,
          body: arrayToObj(args, params),
          json: true
        }).then(res => {
          logger.debug({api: {name, id}}, 'api sucessfully invoked')
          return res
        })
      logger.debug(`APIs ${id} from service ${name} loaded`)
    })
  })

/**
 * Register given services using serviceOpts into the given context
 * All services will be initialized first (order matters) using the given options
 *
 * @param {Object} context - in which services exposed api will be registered
 * @param {Array<Object>} services - services definition including name and init() function
 * @param {Object} serviceOpts - service individual options
 * @param {Bunyan} logger - logger used to report init
 * @returns {Promise} promise - resolve without argument when all service apis have been exposed into context
 */
exports.registerLocal = (context, services, serviceOpts, logger) => {
  const valid = serviceschema.validate(services)
  if (valid.error) return Promise.reject(valid.error)
  return [Promise.resolve()].concat(services)
    .reduce((previous, {name, init}) =>
      previous
        .then(() => {
          const initialized = init(Object.assign({logger}, serviceOpts[name]))
          if (Promise.resolve(initialized) !== initialized) {
            throw new Error(`service ${name} init() method didn't returned a promise`)
          }
          return initialized
        })
        .then(apis => {
          if (!isApi(apis)) return
          for (const id in apis) {
            const validate = apis[id].validate
            // extrat param names for validation
            const params = getParamNames(apis[id])
            let schema = null

            if (validate) {
              // use hash instead of array for more understandable error messages
              schema = joi.object(arrayToObj(validate, params)).unknown(false)
            }

            // enrich context with a dedicated function
            context[id] = (...args) => {
              // adds input validation
              if (schema) {
                const error = validateParams(arrayToObj(args, params), schema, id, params.length)
                if (error) {
                  return Promise.reject(error)
                }
              }
              // forces input/output serialization and deserialization to have consistent result with remote client
              return apis[id](...JSON.parse(JSON.stringify(args)))
                .then(result => JSON.parse(JSON.stringify(result)))
            }
          }
          logger.debug({apis: Object.keys(apis)}, `APIs from service ${name} loaded`)
        })
    )
}
