const Joi = require('joi')
const {unauthorized} = require('boom')

/**
 * Initialize service and returns an object containing APIs functions
 * @param {Object} opts - service opts
 * @returns {Promise<Object>} resolve with an object containing exposed APIs
 */
module.exports = (opts = {}) => {
  const apis = {
    /**
     * Respond to ping
     * @async
     * @returns {Object} an object containing `time` property with current time
     */
    async ping () {
      return {time: new Date()}
    },

    /**
     * Kindly say hello, and demonstrate how to validate input parameters
     * @async
     * @param {String} name person to greet
     * @returns {String} a greeting string message
     */
    async greeting (name = 'John') {
      return `Hello ${name}${opts.greetings || ''} !`
    },

    /**
     * Failing API to test rejection handling
     * @async
     * @throws always an error
     */
    async failing () {
      throw new Error('something went really bad')
    },

    /**
     * API that synchronously fails when executing
     * @throws always an error
     */
    errored () {
      throw new Error('errored API')
    },

    /**
     * API that returns undefined
     * @async
     */
    async getUndefined () {
      return undefined
    },

    /**
     * API that generates a 401 Boom error
     * @async
     * @throws always an Unauthorized Boom error with custom message
     */
    async boomError () {
      throw unauthorized('Custom authorization error')
    },

    /**
     * API with exotic signature including
     * - destructured parameters
     * - default values
     * - rest parameters
     * @async
     * @param {Array} param1  - array of anything
     * @param {Object} param2 - object that could contain a property named c
     * @param {Any} other     - array of other parameters
     * @returns {Array} array of effective parameters
     */
    async withExoticParameters ([a, b], {c: {d}} = {}, ...other) {
      return [a, b, d, ...other]
    }
  }

  // adds input validation
  apis.greeting.validate = [Joi.string().required()]

  return apis
}
