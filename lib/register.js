const request = require('request-promise-native')
const crc32 = require('crc32')
const joi = require('joi')
const {
  arrayToObj,
  checksumHeader,
  extractGroups,
  extractValidate,
  getParamNames,
  isApi,
  validateParams
} = require('mini-service-utils')

/**
 * Internal API registration functions
 * @module register
 */

/**
 * @private
 * @summary Created operation should be regrouped according to their own group
 * @description Registering operations could occur:
 * - on root context when operation belongs to group named afer the service
 * - on group subobject when operation belongs to a different group
 *
 * @param {Object} context       root context in which operations will be created
 * @param {String} group        group name currently processed
 * @param {Object} exposed      options describing local/remote service
 * @param {String} exposed.name of current service
 * @returns {Object} in which operations could be registered as functions
 */
const computeGroup = (context, group, exposed) => {
  // use group if it's not the service name
  if (group !== exposed.name) {
    // creates group if not present yet
    if (!(group in context)) {
      context[group] = {}
    }
    return context[group]
  }
  return context
}

/**
 * @private
 * @summary Checksum validation: fail if not compatible
 * @description Extract actual checksum from Http response header, and compare it to expected
 * If they differ:
 * - mark existing exposed API as deprecated. They will trigger an error
 * - fetch new exposed API, and creates new groups and function
 * - invoke the current API to fullfill invoked API
 *
 * @param {Response} response Http response
 * @param {String} checksum   expected checksum
 * @param {String} client     expected server version (for error message)
 * TODO
 */
const checkCompatibility = (response, checksum, client, group, id, args) => {
  const {options: {remote, logger}, exposed, internalVersion: previousVersion} = client
  // checksum validation: fail if not compatible
  const actualChecksum = response.headers[checksumHeader]
  // TODO no checksum found
  if (actualChecksum === checksum) {
    return Promise.resolve(response.body)
  }
  logger.info('Remote server change detected')
  // server has changed, marks existing methods as deprecated
  exposed.apis.forEach(({group, id}) => {
    computeGroup(client, group, exposed)[id] = () =>
      Promise.reject(new Error(`Remote server isn't compatible with current client (expects ${previousVersion})`))
    logger.debug(`API ${id} from ${group} deprecated`)
  })
  // then register once more
  return exports.registerFromServer(client, remote, logger)
    .then(() =>
      // now invokes the current API once more.
      computeGroup(client, group, client.exposed)[id](...args)
    )
}

/**
 * @summary Ask a given server for APIs to register into the given context (remote client)
 *
 * @param {Object} client   in which exposed api will be registered
 * @param {String} url      remote server that exposes the APIs
 * @param {Bunyan} logger   logger used to report init
 * @returns {Promise}       resolve without argument when all apis have been exposed into context
 */
exports.registerFromServer = (client, url, logger) => {
  logger.info(`Fetch exposed API from ${url}`)
  return request({
    method: 'GET',
    uri: `${url}/api/exposed`,
    json: true
  }).then(exposed => {
    // update client version
    client.internalVersion = `${exposed.name}@${exposed.version}`
    client.exposed = exposed
    const checksum = crc32(JSON.stringify(exposed.apis))
    // add one method to client per exposed api
    exposed.apis.forEach(({group, path, id, params}) => {
      logger.debug(`API ${id} from ${group} loaded (${client.internalVersion})`)
      const method = params.length ? 'POST' : 'GET'
      computeGroup(client, group, exposed)[id] = (...args) =>
        request({
          method,
          uri: `${url}${path}`,
          body: arrayToObj(args, params),
          json: true,
          resolveWithFullResponse: true
        }).then(response =>
          checkCompatibility(response, checksum, client, group, id, args)
        ).then(result => {
          logger.debug({api: {group, id}}, 'api sucessfully invoked')
          return result
        }).catch(err => {
          if (err.statusCode === 400 && err.error) {
            throw new Error(err.error.message)
          }
          throw err
        })
    })
  })
}

/**
 * @summary Register given APIs using into the given context (local client)
 * @description All API groups will be initialized first (order matters) using the given options
 * APIs could be exposed:
 * - directly using `opts.name` & `opts.init`
 * - with groups using `opts.groups` and opts.groupOpts`
 *
 * @param {Object} context  in which exposed api will be registered
 * @param {Object} opts     parameters used to declare APIs and APIs groups
 * @param {String} opts.name            service name
 * @param {String} opts.version         service version
 * @param {Function} [opts.init]        initialization function that takes options as parameter and returns
 * a Promise resolved with exposed APIs (an object with functions that returns promises).
 * Takes precedence over `opts.groups` as a simpler alternative of API group.
 * The `opts` object itself will be used as options for this single API group.
 * @param {Array<Object>} [opts.groups] exposed APIs groups, an array containing for each group:
 * @param {String} opts.groups.name       group friendly name (a valid JavaScript identifier)
 * @param {Function} opts.groups.init     initialization function that takes options as parameter and returns
 * a Promise resolved with exposed APIs (an object with functions that returns promises)
 * @param {Object} [opts.groupOpts]     per-group configuration. might contain a properties named after group
 * @param {Bunyan} logger   logger used to report init
 * @returns {Promise}       resolve without argument when all apis have been exposed into context
 */
exports.registerLocal = (context, opts, logger) => {
  try {
    const {groups, groupOpts} = extractGroups(opts)
    return [Promise.resolve()].concat(groups)
      .reduce((previous, {name: group, init}) =>
        previous
          .then(() => {
            const initialized = init(Object.assign({logger}, groupOpts[group]))
            if (Promise.resolve(initialized) !== initialized) {
              throw new Error(`${group} init() method didn't returned a promise`)
            }
            return initialized
          })
          .then(apis => {
            if (!isApi(apis)) return
            for (const id in apis) {
              const validate = extractValidate(id, apis, groupOpts[group])
              // extrat param names for validation
              const params = getParamNames(apis[id])
              let schema = null

              if (validate) {
                // use hash instead of array for more understandable error messages
                schema = joi.object(arrayToObj(validate, params)).unknown(false)
              }

              // enrich context with a dedicated function
              computeGroup(context, group, opts)[id] = (...args) => {
                // adds input validation
                if (schema) {
                  const error = validateParams(arrayToObj(args, params), schema, id, params.length)
                  if (error) {
                    return Promise.reject(error)
                  }
                }
                // forces input/output serialization and deserialization to have consistent result with remote client
                try {
                  return apis[id](...JSON.parse(JSON.stringify(args)))
                    .then(result => {
                      if (result !== undefined) {
                        return JSON.parse(JSON.stringify(result))
                      }
                      return result
                    })
                } catch (exc) {
                  // bubble any synchronous problem (not returning promise, serialization issue...)
                  exc.message = `Error while calling API ${id}: ${exc.message}`
                  return Promise.reject(exc)
                }
              }
              logger.debug(`API ${id} from ${group} loaded`)
            }
          })
      )
  } catch (err) {
    return Promise.reject(err)
  }
}
