'use strict'

const test = require('tape')
const nock = require('nock')
const single = require('@telemetry-js/metric').single
const plugin = require('..')

test('publish two metrics, with manual flush', function (t) {
  t.plan(2)

  const publisher = plugin({ token: 'dummy' })
  const builder = publisher._builder
  const now = new Date()

  publisher.publish(single('test.count', { unit: 'count', value: 1, date: now }))
  publisher.publish(single('test.count', { unit: 'count', value: 2, date: now }))

  nock('https://' + builder._host).post(builder._path).reply(function (url, body) {
    t.same(body, {
      measurements: [{
        name: 'test.count',
        time: Math.round(now.getTime() / 1e3),
        tags: {},
        attributes: {
          display_units_short: 'count',
          display_units_long: 'Count'
        },
        value: 1
      }, {
        // Second measurement should have no attributes, because they are only
        // needed for new metrics, and the plugin has already seen this name.
        name: 'test.count',
        time: Math.round(now.getTime() / 1e3),
        tags: {},
        value: 2
      }]
    })

    return [200, '']
  })

  publisher.flush((err) => {
    t.ifError(err, 'no flush error')
  })
})

test('ping() triggers a flush', function (t) {
  t.plan(2)

  const publisher = plugin({ token: 'dummy' })
  const builder = publisher._builder
  const now = new Date()

  publisher.publish(single('test.count', { unit: 'count', value: 1, date: now }))

  nock('https://' + builder._host).post(builder._path).reply(function (url, body) {
    t.pass('sent')
    return [200, '']
  })

  publisher.ping((err) => {
    t.ifError(err, 'no ping error')
  })
})

test('stop() triggers a flush', function (t) {
  t.plan(2)

  const publisher = plugin({ token: 'dummy' })
  const builder = publisher._builder
  const now = new Date()

  publisher.publish(single('test.count', { unit: 'count', value: 1, date: now }))

  nock('https://' + builder._host).post(builder._path).reply(function (url, body) {
    t.pass('sent')
    return [200, '']
  })

  publisher.stop((err) => {
    t.ifError(err, 'no stop error')
  })
})

test('stop() waits for current flush and then triggers a second flush', function (t) {
  t.plan(4)

  const publisher = plugin({ token: 'dummy' })
  const builder = publisher._builder
  const now = new Date()
  const order = []

  publisher.publish(single('test.count', { unit: 'count', value: 1, date: now }))

  nock('https://' + builder._host).post(builder._path).delay(300).reply(function (url, body) {
    t.pass('sent')
    return [200, '']
  })

  publisher.on('_flush', () => {
    order.push('_flush')
  })

  publisher.ping((err) => {
    order.push('pinged')
    t.ifError(err, 'no ping error')
  })

  publisher.stop((err) => {
    order.push('stopped')
    t.ifError(err, 'no stop error')
    t.same(order, ['pinged', '_flush', '_flush', 'stopped'])
  })
})
