'use strict'

const test = require('tape')
const nock = require('nock')
const RequestBuilder = require('../lib/req-builder')

test('RequestBuilder', function (t) {
  t.plan(4)

  const builder = new RequestBuilder({
    token: 'xxx'
  })

  builder.addSingleMetric({
    name: 'test.count',
    date: new Date(0),
    unit: 'count',
    resolution: 60,
    value: 2.5,
    tags: {
      tag1: '1',
      tag2: '2'
    }
  })

  // A repeated metric should not get attributes
  builder.addSingleMetric({
    name: 'test.count',
    date: new Date(1000),
    unit: 'count',
    resolution: 60,
    value: -3,
    tags: {
      tag1: '1',
      tag2: '2'
    }
  })

  builder.addSingleMetric({
    name: 'test.bytes',
    date: new Date(1000),
    unit: 'bytes',
    value: 200,
    tags: {
      tag3: '3'
    }
  })

  builder.addSummaryMetric({
    name: 'test.seconds',
    date: new Date(2000),
    unit: 'seconds',
    stats: {
      min: 1,
      max: 2,
      sum: 3,
      count: 2
    },
    tags: {}
  })

  builder.addSummaryMetric({
    name: 'test.percent',
    date: new Date(3000),
    unit: 'percent',
    stats: {
      min: 10.2,
      max: 25,
      sum: 50,
      count: 3
    },
    tags: {
      tag1: '1'
    }
  })

  const expectedMeasurements = fixture()

  t.same(builder._measurements, expectedMeasurements, 'got measurements')

  builder.on('send', function (requestOptions) {
    t.same(requestOptions, {
      hostname: 'api.appoptics.com',
      port: null,
      path: '/v1/measurements',
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'content-length': '689',
        authorization: 'Basic eHh4Og=='
      }
    })
  }, 'signed request')

  const scope = nock('https://' + builder._host).post(builder._path).reply(function (url, body) {
    t.same(body, {
      measurements: expectedMeasurements
    })

    return [200, '']
  })

  builder.send((err) => {
    t.ifError(err, 'no send error')
    scope.done()
  })
})

test('retry', function (t) {
  t.plan(8)

  const builder = new RequestBuilder({
    token: 'xxx',
    retryDelay: 200
  })

  builder.addSingleMetric({
    name: 'test.count',
    date: new Date(0),
    unit: 'count',
    resolution: 60,
    value: 2.5,
    tags: {
      tag1: '1',
      tag2: '2'
    }
  })

  // A repeated metric should not get attributes
  builder.addSingleMetric({
    name: 'test.count',
    date: new Date(1000),
    unit: 'count',
    resolution: 60,
    value: -3,
    tags: {
      tag1: '1',
      tag2: '2'
    }
  })

  builder.addSingleMetric({
    name: 'test.bytes',
    date: new Date(1000),
    unit: 'bytes',
    value: 200,
    tags: {
      tag3: '3'
    }
  })

  builder.addSummaryMetric({
    name: 'test.seconds',
    date: new Date(2000),
    unit: 'seconds',
    stats: {
      min: 1,
      max: 2,
      sum: 3,
      count: 2
    },
    tags: {}
  })

  builder.addSummaryMetric({
    name: 'test.percent',
    date: new Date(3000),
    unit: 'percent',
    stats: {
      min: 10.2,
      max: 25,
      sum: 50,
      count: 3
    },
    tags: {
      tag1: '1'
    }
  })

  const expectedMeasurements = fixture()

  t.same(builder._measurements, expectedMeasurements, 'got measurements')

  builder.on('send', function (requestOptions) {
    t.same(requestOptions, {
      hostname: 'api.appoptics.com',
      port: null,
      path: '/v1/measurements',
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'content-length': '689',
        authorization: 'Basic eHh4Og=='
      }
    })
  }, 'signed request')

  const scope = nock('https://' + builder._host)
    .post(builder._path).reply(function (url, body) {
      t.same(body, { measurements: expectedMeasurements })
      return [500, '']
    })
    .post(builder._path).reply(function (url, body) {
      t.same(body, { measurements: expectedMeasurements })
      return [429, '']
    })
    .post(builder._path).reply(function (url, body) {
      t.same(body, { measurements: expectedMeasurements })
      return [200, '']
    })

  builder.send((err) => {
    t.ifError(err, 'no send error')
    scope.done()
  })
})

test('disable retry', function (t) {
  t.plan(2)

  const builder = new RequestBuilder({
    token: 'xxx',
    retry: false
  })

  builder.addSingleMetric({
    name: 'test.count',
    date: new Date(0),
    unit: 'count',
    resolution: 60,
    value: 2.5,
    tags: {
      tag1: '1',
      tag2: '2'
    }
  })

  const scope = nock('https://' + builder._host)
    .post(builder._path).reply(function (url, body) {
      t.pass('got request')
      return [500, '']
    })

  builder.send((err) => {
    t.is(err.message, 'HTTP 500: -')
    scope.done()
  })
})

test('adds response body of failed request to error', function (t) {
  t.plan(1)

  const builder = new RequestBuilder({
    token: 'xxx',
    retryDelay: 200
  })

  builder.addSingleMetric({
    name: 'test.count',
    date: new Date(0),
    unit: 'count',
    resolution: 60,
    value: 2.5,
    tags: {
      tag1: '1',
      tag2: '2'
    }
  })

  const scope = nock('https://' + builder._host)
    .post(builder._path).reply(function (url, body) {
      return [400, '{"errors":[]}']
    })

  builder.send((err) => {
    t.is(err.message, 'HTTP 400: {"errors":[]}')
    scope.done()
  })
})

test('timeout', function (t) {
  t.plan(1)

  const builder = new RequestBuilder({
    token: 'xxx',
    timeout: 200
  })

  builder.addSingleMetric({
    name: 'test.count',
    date: new Date(0),
    unit: 'count',
    resolution: 60,
    value: 2.5,
    tags: {
      tag1: '1',
      tag2: '2'
    }
  })

  const scope = nock('https://' + builder._host)
    .post(builder._path).socketDelay(2000).reply(200, 'foo')

  builder.send((err) => {
    t.is(err.message, 'Socket timeout (200ms)')
    scope.done()
  })
})

function fixture () {
  return [{
    name: 'test.count',
    time: 0,
    tags: {
      tag1: '1',
      tag2: '2'
    },
    attributes: {
      display_units_short: 'count',
      display_units_long: 'Count'
    },
    value: 2.5
  }, {
    name: 'test.count',
    time: 1,
    tags: {
      tag1: '1',
      tag2: '2'
    },
    value: -3
  }, {
    name: 'test.bytes',
    time: 1,
    tags: {
      tag3: '3'
    },
    attributes: {
      display_units_short: 'bytes',
      display_units_long: 'Bytes'
    },
    value: 200
  }, {
    name: 'test.seconds',
    time: 2,
    tags: {},
    attributes: {
      display_units_short: 's',
      display_units_long: 'Seconds'
    },
    sum: 3,
    min: 1,
    max: 2,
    count: 2
  }, {
    name: 'test.percent',
    time: 3,
    tags: {
      tag1: '1'
    },
    attributes: {
      display_units_short: '%',
      display_units_long: 'Percent'
    },
    sum: 50,
    min: 10.2,
    max: 25,
    count: 3
  }]
}
