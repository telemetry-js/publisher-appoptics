# publisher-appoptics

> **Publish single or summary metrics to AppOptics.**  
> A [`telemetry`](https://github.com/telemetry-js/telemetry) plugin.

[![npm status](http://img.shields.io/npm/v/telemetry-js/publisher-appoptics.svg)](https://www.npmjs.org/package/@telemetry-js/publisher-appoptics)
[![node](https://img.shields.io/node/v/@telemetry-js/publisher-appoptics.svg)](https://www.npmjs.org/package/@telemetry-js/publisher-appoptics)
[![Test](https://github.com/telemetry-js/publisher-appoptics/workflows/Test/badge.svg?branch=main)](https://github.com/telemetry-js/publisher-appoptics/actions)
[![JavaScript Style Guide](https://img.shields.io/badge/code_style-standard-brightgreen.svg)](https://standardjs.com)

## Table of Contents

<details><summary>Click to expand</summary>

- [Usage](#usage)
  - [With Telemetry](#with-telemetry)
  - [Standalone](#standalone)
- [API](#api)
  - [Options](#options)
- [Install](#install)
- [Acknowledgements](#acknowledgements)
- [License](#license)

</details>

## Usage

### With Telemetry

```js
const telemetry = require('@telemetry-js/telemetry')()
const appoptics = require('@telemetry-js/publisher-appoptics')

telemetry.task()
  .publish(appoptics, { token: 'XX' })
```

If an HTTP request to AppOptics fails, it is retried. If it fails 5 times, an `error` event will be emitted and in this case forwarded to `telemetry`:

```js
telemetry.on('error', (err) => {
  console.error(err)
})
```

### Standalone

_Yet to document._

```js
const appoptics = require('@telemetry-js/publisher-appoptics')
```

## API

### Options

_Yet to document._

## Install

With [npm](https://npmjs.org) do:

```
npm install @telemetry-js/publisher-appoptics
```

## Acknowledgements

This project is kindly sponsored by [Reason Cybersecurity Inc](https://reasonsecurity.com).

[![reason logo](https://cdn.reasonsecurity.com/github-assets/reason_signature_logo.png)](https://reasonsecurity.com)

## License

[MIT](LICENSE) © Vincent Weevers
