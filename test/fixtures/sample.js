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
     * @returns {Promise<Object>} resolved with an object containing:
     * @returns {Date} time - ping current time
     */
    async ping () {
      return {time: new Date()}
    },

    /**
     * Kindly say hello, and demonstrate how to validate input parameters
     * @param {String} name person to greet
     * @returns {Promise<String>} resolved with a greeting string message
     */
    async greeting (name) {
      return `Hello ${name}${opts.greetings || ''} !`
    },

    /**
     * Failing API to test rejection handling
     * @returns {Promise} always rejected
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
     * @returns {Promise<undefined>} promise resolved with nothing
     */
    async getUndefined () {
      return undefined
    },

    /**
     * API that generates a 401 Boom error
     * @returns {Promise} rejected with Unauthorized Boom error with custom message
     */
    async boomError () {
      throw unauthorized('Custom authorization error')
    }
  }

  // adds input validation
  apis.greeting.validate = [Joi.string().required()]

  return apis
}
