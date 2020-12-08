'use strict'

const units = require('@telemetry-js/metric').units
const concat = require('simple-concat')
const https = require('https')
const EventEmitter = require('events').EventEmitter
const URL = require('url')

const MAX_ATTEMPTS = 10
const TOO_MANY_REQUESTS = 429
const RECOVERABLE_NET_ERRORS = new Set([
  'EAI_AGAIN', // Dns lookup timeout
  'ENOTFOUND', // Dns lookup returned no result
  'ETIMEDOUT', // Connection timed out
  'ESOCKETTIMEDOUT', // Read timeout
  'ECONNREFUSED', // Connection refused
  'ECONNRESET', // Connection reset
  'EHOSTUNREACH', // Host is unreachable
  'EPIPE' // Broken pipe
])

module.exports = class RequestBuilder extends EventEmitter {
  constructor ({ endpoint, token, namespace, retry, retryDelay, timeout }) {
    super()

    retry = retry !== false
    retryDelay = retryDelay || 1e3
    timeout = timeout || 60e3

    if (typeof token !== 'string' || token === '') {
      throw new TypeError('The "token" option must be a non-empty string')
    }

    if (typeof retryDelay !== 'number' || retryDelay <= 0) {
      throw new TypeError('The "retryDelay" option must be a positive number')
    }

    if (typeof timeout !== 'number' || timeout <= 0) {
      throw new TypeError('The "timeout" option must be a positive number')
    }

    this._endpoint = endpoint || 'https://api.appoptics.com/v1/measurements'

    // TODO (later): "may only consist of ‘A-Za-z0-9.:-_’"
    this._namespace = namespace || null
    this._token = token
    this._enableRetry = retry
    this._retryDelay = retryDelay
    this._requestTimeout = timeout

    // eslint-disable-next-line
    const parsed = URL.parse(this._endpoint)

    this._host = parsed.host
    this._hostname = parsed.hostname
    this._port = parsed.port
    this._path = parsed.path

    this._measurements = []
    this._seen = new Set()
  }

  addSingleMetric (metric) {
    const measurement = this._createMeasurement(metric)
    measurement.value = metric.value
  }

  // TODO (later): stats.last, stats.stddev
  addSummaryMetric (metric) {
    const measurement = this._createMeasurement(metric)
    const { sum, min, max, count } = metric.stats

    measurement.count = count

    if (count > 0) {
      measurement.sum = sum
      measurement.min = min
      measurement.max = max
    }
  }

  _createMeasurement (metric) {
    const name = metric.name

    // TODO (!): period
    const measurement = {
      name: this._namespace !== null ? `${this._namespace}.${name}` : name,
      time: Math.round(metric.date.getTime() / 1000),
      tags: metric.tags
    }

    if (!this._seen.has(name)) {
      this._seen.add(name)

      // This could be a new metric, so include additional attributes that
      // AppOptics will use to create the metric if it does not exist yet.
      const unit = units.get(metric.unit)

      measurement.attributes = {
        display_units_short: unit.shortName,
        display_units_long: unit.longName
      }

      if (metric.statistic !== undefined && metric.statistic !== 'average') {
        // "Determines how to calculate values when rolling up from raw values
        // to higher resolution intervals. Must be one of: 'average', 'sum',
        // 'count', 'min', 'max'. If summarize_function is not set the behavior
        // defaults to average."
        measurement.attributes.summarize_function = metric.statistic
      }
    }

    this._measurements.push(measurement)
    return measurement
  }

  hasData () {
    return this._measurements.length !== 0
  }

  send (callback) {
    const measurements = this._measurements
    if (measurements.length === 0) return process.nextTick(callback)

    this._measurements = []
    this._makeRequest(JSON.stringify({ measurements }), 1, callback)
  }

  _makeRequest (body, attempt, callback) {
    const requestOptions = {
      hostname: this._hostname,
      port: this._port,
      path: this._path,
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'content-length': String(Buffer.byteLength(body)),
        authorization: 'Basic ' + encodeBasicAuthentication(this._token)
      }
    }

    // For debugging purposes
    this.emit('send', requestOptions)

    let called = 0
    const finish = (err, statusCode) => {
      if (called++) {
        return
      }

      if (err && this._enableRetry && attempt < MAX_ATTEMPTS) {
        if (RECOVERABLE_NET_ERRORS.has(err.code)) {
          // Retry (without exponential delay, by design)
          return setTimeout(this._makeRequest.bind(this, body, attempt + 1, callback), this._retryDelay)
        } else if (statusCode === TOO_MANY_REQUESTS || (statusCode >= 500 && statusCode < 600)) {
          // Retry (without exponential delay, by design)
          return setTimeout(this._makeRequest.bind(this, body, attempt + 1, callback), this._retryDelay)
        }
      }

      callback(err, statusCode)
    }

    const request = https.request(requestOptions, (res) => {
      const statusCode = res.statusCode

      if (statusCode >= 200 && statusCode < 300) {
        // Discard response.
        res.destroy()
        return finish(null, statusCode)
      }

      concat(res, function (err, buf) {
        // If we could not consume the response, ignore it.
        const description = err ? '-' : buf.toString() || '-'

        finish(new Error(`HTTP ${statusCode}: ${description}`), statusCode)
      })
    }).on('error', finish).on('timeout', () => {
      // This error is not retried.
      finish(new Error(`Socket timeout (${this._requestTimeout}ms)`))
      request.abort()
    })

    request.setTimeout(this._requestTimeout)
    request.end(body)
  }
}

function encodeBasicAuthentication (token) {
  return Buffer.from(token + ':').toString('base64')
}
