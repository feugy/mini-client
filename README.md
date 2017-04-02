[![NPM Version][npm-image]][npm-url]
[![Dependencies][david-image]][david-url]
[![Build][travis-image]][travis-url]
[![Test Coverage][coveralls-image]][coveralls-url]

# Minimalist µServices

Mini-client is a generic client for µServices built with [mini-service][mini-service-url].
The goal of mini-service is to give the minimal structure to implement a µService, that can be invoked locally or remotely.

Its principles are the following:
- very easy to add new service api endpoints
- easy to use client interface, same usage both locally and remotely
- hide deployment details and provide simple-yet-working solution
- promises based

mini-client & mini-service use the latest ES6 features, so they requires node 6+

Please checkout the [API reference][api-reference]

This project was kindly sponsored by [nearForm][nearform].


## Generic client for mini-services

Mini-client expose a generic client that can be wired to any service exposed with [mini-service][mini-service-url].
It provides an JavaScript object, that will fetch exposed APIs and creates a function for each of them.
This allow to invoke remote API like if they were plain function (it's a kind of good old RPC).

`caller-remote.js`
```javascript
const getClient = require('mini-client')

const calc = getClient({
  remote: 'http://localhost:3000'
})
calc.add(10, 5).then(sum => console.log(`Result is: ${sum}`))
```

Each API will end-up as a function (named after the API itself) that returns a promise.
Calling a function that isn't an exposed API will fails as if you try to invoked an unknown property of a regular
 object.

At the first call, mini-client fetch from the remote server the exposed API and creates the actual functions.

After being initialized, a mini-client can't be wired to another service, and will always try to invoke the one it
was initiliazed with.

Please note that you can call `init()` (see bellow), which doesn't do anything in "remote mode".


## Generic client for local services

While calling remote service is a realistic scenario for production environments, it's more convenient to run
all code in the same unit on dev (for debugging) and in continuous integration.

That's why mini-client can run the in "local mode".
In this case, the service definition is loaded at initialization.

`caller-local.js`
```javascript
const getClient = require('mini-client')
const calcService = require('./calc-service')

const calc = getClient(calcService)
calc.init().then(() =>
  calc.add(10, 5).then(sum => console.log(`Result is: ${sum}`))
)
```

Two noticeable difference with "remote mode":
- you need to provide the [service definition][service-definition-url] when creating the client
- you need to invoke `init()` prior to any call, which run exposed API initialization code
(as if the server were starting)

Then, you can invoke exposed APIs as function like in "remote mode".


## Validations

When invoking an exposed API, Mini-client can report parameters validation error.
If the distant service denies the operation because of a missing or errored parameter,
the returned promise will be rejected with the appropriate error message.


## License

Copyright [Damien Simonin Feugas][feugy] and other contributors, licensed under [MIT](./LICENSE).


## Changelog

### 2.0.0
- Introduce new terminology, with service descriptor and API groups
- Allow to declare API without groups
- Allow to declare API validation in group options
- Force name+version on local client
- When parsing exposed APIs, expect 'group' property instead of 'name'
- Better documentation
- More understandable error messages

### 1.0.0
- initial release

[nearform]: http://nearform.com
[feugy]: https://github.com/feugy
[mini-service-url]: https://github.com/feugy/mini-service
[david-image]: https://img.shields.io/david/feugy/mini-client.svg
[david-url]: https://david-dm.org/feugy/mini-client
[npm-image]: https://img.shields.io/npm/v/mini-client.svg
[npm-url]: https://npmjs.org/package/mini-client
[travis-image]: https://api.travis-ci.org/feugy/mini-client.svg
[travis-url]: https://travis-ci.org/feugy/mini-client
[coveralls-image]: https://img.shields.io/coveralls/feugy/mini-client/master.svg
[coveralls-url]: https://coveralls.io/r/feugy/mini-client?branch=master
[api-reference]: https://feugy.github.io/mini-client/
[mini-service-url]: https://github.com/feugy/mini-service/
[service-definition-url]: https://github.com/feugy/mini-service#example