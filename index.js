'use strict'

const RequestBuilder = require('./lib/req-builder')
const EventEmitter = require('events').EventEmitter

module.exports = function plugin (options) {
  return new AppOpticsPublisher(options)
}

class AppOpticsPublisher extends EventEmitter {
  constructor (options) {
    super()
    if (!options) options = {}

    this._backgroundFlushCallback = this._backgroundFlushCallback.bind(this)
    this._backgroundFlushing = false
    this._builder = new RequestBuilder({
      endpoint: options.endpoint,
      token: options.token,
      namespace: options.namespace,
      retryDelay: options.retryDelay
    })
  }

  publish (metric) {
    if (metric.isSingle()) {
      this._builder.addSingleMetric(metric)
    } else if (metric.isSummary()) {
      this._builder.addSummaryMetric(metric)
    }

    // TODO (later): flush now if measurements.length is 1000 (the max)
    // TODO (later): does that mean publish should be async?
  }

  ping (callback) {
    if (!this._builder.hasData()) {
      // No need to dezalgo ping()
      return callback()
    }

    // Perform HTTP requests in background, to not delay other plugins.
    if (!this._backgroundFlushing) {
      this._backgroundFlush()
    }

    callback()
  }

  stop (callback) {
    if (this._backgroundFlushing) {
      this.once('_flush', this.stop.bind(this, callback))
    } else {
      this.once('_flush', callback)
      this._backgroundFlush()
    }
  }

  _backgroundFlush () {
    this._backgroundFlushing = true
    this.flush(this._backgroundFlushCallback)
  }

  _backgroundFlushCallback (err) {
    this._backgroundFlushing = false
    if (err) this.emit('error', err)
    this.emit('_flush')
  }

  // Exposed for standalone usage
  flush (callback) {
    if (callback === undefined) {
      var promise = new Promise((resolve, reject) => {
        callback = function (err, result) {
          if (err) reject(err)
          else resolve(result)
        }
      })
    }

    this._builder.send(callback)
    return promise
  }
}
