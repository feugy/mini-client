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


This project was kindly sponsored by [nearForm][nearform].


## Generic client

TODO


## License

Copyright [Damien Simonin Feugas][feugy] and other contributors, licensed under [MIT](./LICENSE).

## Changelog

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