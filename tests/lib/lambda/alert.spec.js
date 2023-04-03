const chai = require('chai')
const path = require('path')
const spies = require('chai-spies')
const proxyquire = require('proxyquire')

chai.use(spies)

const { expect } = chai

const snsMock = chai.spy.interface({
  publish: () => ({
    promise: () => Promise.resolve(),
  }),
})

const awsMock = {
  // Declaring SNS mock as a class
  SNS: function () { // eslint-disable-line object-shorthand, func-names
    this.publish = snsMock.publish
  },
}

const alert = proxyquire(
  '../../../lib/lambda/alert.js', {
    'aws-sdk': awsMock,
  })


// eslint-disable-next-line import/no-dynamic-require
const sampling = require(path.join('..', '..', '..', 'lib', 'lambda', 'sampling.js'))

let analysis
let result

describe('Alerting', () => {
  describe('#briefAnalysis', () => {
    it('removes latencies from reports before stringifying the analysis', () => {
      analysis = {
        errors: 1,
        errorMessage: `sampling test failure: 1/2 exceeded budget of ${sampling.defaults.monitoring.DefaultErrorBudget} errors`,
        reports: [
          {
            errors: {
              404: sampling.defaults.monitoring.errorBudget + 1,
            },
            latencies: ['stuff', 'we', 'don\'t', 'want'],
          },
          {
            errors: {},
            latencies: ['stuff', 'we', 'don\'t', 'want'],
          },
        ],
      }
      const preAnalysis = JSON.parse(JSON.stringify(analysis))
      result = JSON.parse(alert.briefAnalysis(analysis))
      expect(analysis).to.eql(preAnalysis) // leaves the given analysis unchanged
      delete analysis.reports[0].latencies // destructive change after already calling briefAnalysis
      delete analysis.reports[1].latencies
      expect(result).to.eql(analysis) // doesn't contain latencies
    })
  })
  describe('#send', () => {
    const topicArn = process.env.TOPIC_ARN
    afterEach(() => {
      if (topicArn) {
        process.env.TOPIC_ARN = topicArn
      }
    })
    it('Logs a warning if the alerting code doesn\'t have its required configuration', () => {
      delete process.env.TOPIC_ARN
      const consoleLog = console.error
      let logCalled = false
      console.error = () => {
        logCalled = true
      }
      try {
        return alert.send({}, {})
          .then(() => expect(logCalled).to.be.true)
      } finally {
        console.error = consoleLog
      }
    })
    it('sends an alert to SNS using the given TOPIC_ARN', () => {
      process.env.TOPIC_ARN = 'arn:aws:sns:us-east-1:123456789012:my_corporate_topic'
      return alert.send({}, { reports: [] })
        .then(() => {
          expect(snsMock.publish).to.have.been.called.once
          // eslint-disable-next-line no-underscore-dangle
          expect(snsMock.publish.__spy.calls[0][0].TopicArn).to.eql(process.env.TOPIC_ARN)
        })
    })
  })
})
