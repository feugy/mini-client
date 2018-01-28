# Changelog

## 3.3.0
- Replace internals to use latest validation mecanics
  Error message when invoking an API with too many parameters is slightly different.
  Previously: `must contain at most`, now: `"x" is not allowed`
- Dependencies update

## 3.2.1
- Allow http request timeout configuration

## 3.2.0
- Support synchronous `init()` and API functions
- API call fails with proper error it no checksum found
- Dependencies update

## 3.1.0
- Automatically reloads exposed APIs when remote server has changed, and mark previous APIs as deprecated
- Use [standard.js](https://standardjs.com/) lint configuration
- Don't fail if an API resolves or returns `undefined` value.

## 3.0.0
- [*Breaking change*] Groups are now used as sub-objects of client.
- Use CRC32 checksum to validate that remote server is compatible
- Dependencies update

## 2.0.0
- Introduce new terminology, with service descriptor and API groups
- Allow to declare API without groups
- Allow to declare API validation in group options
- [*Breaking change*] Force name+version on local client
- [*Breaking change*] When parsing exposed APIs, expect 'group' property instead of 'name'
- Better documentation
- More understandable error messages

## 1.0.0
- initial release
