const {getLogger} = require('mini-service-utils')
const {registerFromServer, registerLocal} = require('./register')

const reserved = ['then', 'catch', 'finally']

/**
 * Generic client to a local or remote µService built with mini-service.
 * @class
 */
class Client {
  /**
   * Service version.
   *
   * For remote clients, undefined until the first call. Then, set to server's version
   *
   * @member {String}
   */
  get version () {
    return this.internalVersion
  }

  /**
   * Builds a client
   *
   * Local clients need full service definition, including `opts.name` and `opts.version`.
   * Local API could be exposed:
   * - directly using `opts.name` & `opts.init`
   * - with groups using `opts.groups` and `opts.groupOpts`
   *
   * For remote clients, only `opts.remote` is required
   *
   * @constructs
   * @param {Object} opts         client options, including
   * @param {String} [opts.remote]        provide a valid http(s) uri to bind this client to a distant service.
   * Set to null or omit to instanciate the µService locally
   * @param {String} [opts.timeout]       HTTP request timeout (ms). Default to a 20 seconds (remote client only)
   * @param {String} [opts.name]          service name (local client only)
   * @param {String} [opts.version]       service version (local client only)
   * @param {Function} [opts.init]        initialization function that takes options as parameter and returns
   * a Promise resolved with exposed APIs (an object with functions that returns promises).
   * Takes precedence over `opts.groups` as a simpler alternative of API group.
   * The `opts` object itself will be used as options for this single API group.
   * @param {Array<Object>} [opts.groups] exposed APIs groups, an array containing for each group:
   * @param {String} opts.groups.name       group friendly name (a valid JavaScript identifier)
   * @param {Function} opts.groups.init     initialization function that takes options as parameter and returns
   * a Promise resolved with exposed APIs (an object with functions that returns promises)
   * @param {Object} [opts.groupOpts]     per-group configuration. might contain a properties named after group
   */
  constructor (opts = {}) {
    this.initialized = false
    this.options = Object.assign({
      logger: getLogger({name: 'mini-client'}),
      // default HTTP timeout
      timeout: 20e3
    }, opts)

    const {logger, remote} = this.options

    // force unknown version until initialized
    if (this.options.remote) {
      this.internalVersion = 'unknown'
    } else {
      const {name, version} = this.options
      // required name & version
      if (!name || !version) {
        throw new Error('Local client needs "name" and "version" options')
      }
      this.internalVersion = `${name}@${version}`
    }

    const traps = {
      get (target, propKey) {
        // version and init are the only prop callable while proxy is still active
        if (['version', 'internalVersion', 'init', 'initialized', 'options'].includes(propKey)) {
          return target[propKey]
        }
        // reserved keyword that aren't defined must be undefined (thenable false-positive)
        if (reserved.includes(propKey)) {
          return undefined
        }
        // creates a function that will get exposed API from remote server
        return new Proxy(() => { /* esling no-empty: 0 */ }, {
          get (_1, subPropKey) {
            // reserved keyword that aren't defined must be undefined (thenable false-positive)
            if (reserved.includes(subPropKey)) {
              return undefined
            }
            return (...args) => {
              logger.debug(`during ${propKey}.${subPropKey}, connect to ${remote} to get exposed apis`)
              return registerFromServer(target, remote, logger)
                .then(() => {
                  // delete trap to boost performance: next calls will directly search into 'this'
                  delete traps.get
                  logger.debug('remote client ready')
                  // now, invoke the API with initial arguments, but only group exists
                  if (!(propKey in target)) {
                    throw new TypeError(`Cannot read property '${subPropKey}' of undefined`)
                  }
                  // and if property is defined in group
                  if (!(subPropKey in target[propKey])) {
                    throw new TypeError(`${propKey}.${subPropKey} is not a function`)
                  }
                  return target[propKey][subPropKey](...args)
                })
            }
          },
          apply (_1, _2, args) {
            logger.debug(`during ${propKey}, connect to ${remote} to get exposed apis`)
            return registerFromServer(target, remote, logger)
              .then(() => {
                // delete trap to boost performance: next calls will directly search into 'this'
                delete traps.get
                logger.debug('remote client ready')
                // now, invoke the API with initial arguments, but only if defined in group
                if (!(propKey in target)) {
                  throw new TypeError(`${propKey} is not a function`)
                }
                return target[propKey](...args)
              })
          }
        })
      }
    }
    return remote ? new Proxy(this, traps) : this
  }

  /**
   * Initialize the client by registering APIs as client's method.
   *
   * `init()` needs to be called for local clients, as it will invoke service definition's
   * `init()` async methods. But for remote clients, this is a noop, and can be skipped.
   *
   * @returns {Promise} resolved when client is initialized, without any arguments
   */
  init () {
    if (this.initialized || this.options.remote) return Promise.resolve()
    const {logger} = this.options
    return Promise.resolve()
      .then(() =>
        // local: register all available apis serially
        registerLocal(this, this.options, logger)
      ).then(() => {
        this.initialized = true
        logger.debug('local client ready')
      })
  }
}

/**
 * Creates a client that exposes remote or locat µService's APIs.
 *
 * @module index
 * @param {Object} opts   client options, see {@link #Client|Client constructor}
 * @returns {Client} a client to use µService functionnalities
 */
module.exports = (...args) => new Client(...args)
