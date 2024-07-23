const chai = require('chai')
const sinon = require('sinon')
const sinonChai = require('sinon-chai')
const spies = require('chai-spies')
const proxyquire = require('proxyquire')
const fs = require('fs')

chai.use(sinonChai)
chai.use(spies)

const sandbox = chai.spy.sandbox()
const { expect } = chai
const { match, spy } = sinon

// ARTILLERY
// eslint-disable-next-line no-unused-vars
const defaultArtilleryRun = (args) => {
  fs.writeFile(args[1], JSON.stringify({ aggregate: {} }), 'utf8', () => {
    process.exit(0)
  })
}
const artilleryRun = {
  run: defaultArtilleryRun,
}
const artilleryMock = {
  run: (args) => artilleryRun.run(args),
}

// AWS
const awsLambdaMock = {
  invoke: () => Promise.resolve({ Payload: '{}' }),
}
const awsMock = {
  // Declaring Lambda mock as a class
  Lambda: function () { // eslint-disable-line object-shorthand, func-names
    this.invoke = awsLambdaMock.invoke
  },
}

const acceptanceMock = {}
const monitoringMock = {}
const performanceMock = {}

const artilleryTask = proxyquire(
  '../../../lib/lambda/artillery-task', {
    'artillery/lib/cmds/run': artilleryMock,
    '@aws-sdk/client-lambda': awsMock,
    './artillery-acceptance': () => acceptanceMock,
    './artillery-monitoring': () => monitoringMock,
    './artillery-performance': () => performanceMock,
  })

describe('Artillery Task', () => {
  it('uses performance strategy for scripts in performance mode', () => {
    performanceMock.execute = chai.spy()
    artilleryTask.executeTask({})
    expect(performanceMock.execute).to.have.been.called.once

    performanceMock.execute = chai.spy()
    artilleryTask.executeTask({ mode: 'perf' })
    expect(performanceMock.execute).to.have.been.called.once

    performanceMock.execute = chai.spy()
    artilleryTask.executeTask({ mode: 'performance' })
    expect(performanceMock.execute).to.have.been.called.once
  })

  it('uses acceptance strategy for scripts in acceptance mode', () => {
    acceptanceMock.execute = chai.spy()
    artilleryTask.executeTask({ mode: 'acc' })
    expect(acceptanceMock.execute).to.have.been.called.once

    acceptanceMock.execute = chai.spy()
    artilleryTask.executeTask({ mode: 'acceptance' })
    expect(acceptanceMock.execute).to.have.been.called.once
  })

  it('uses monitoring strategy for scripts in monitoring mode', () => {
    monitoringMock.execute = chai.spy()
    artilleryTask.executeTask({ mode: 'mon' })
    expect(monitoringMock.execute).to.have.been.called.once

    monitoringMock.execute = chai.spy()
    artilleryTask.executeTask({ mode: 'monitoring' })
    expect(monitoringMock.execute).to.have.been.called.once
  })

  it('throws exception if an invalid mode is attempted', () => {
    expect(() => artilleryTask.executeTask({ mode: 'never-a-valid-mode' }))
      .to.throw('If specified, the mode attribute must be one of: "perf", "performance", "acc", "acceptance", "mon", "monitoring".')
  })

  it('executes a single plan', () => {
    sandbox.on(artilleryTask, 'execute')
    sandbox.on(artilleryRun, 'run', defaultArtilleryRun)

    return artilleryTask.executeAll({}, {}, [{}])
      .then(() => {
        expect(artilleryTask.execute).to.have.been.called.once
        expect(artilleryRun.run).to.have.been.called.once
      })
  })

  it('distributes and executed the load with multiple plans', () => {
    sandbox.on(artilleryTask, 'invoke', () => Promise.resolve({}))
    sandbox.on(artilleryTask, 'distribute')

    return artilleryTask.executeAll({}, {}, [{ _test: 'frist' }, { _test: 'second' }])
      .then(() => {
        expect(artilleryTask.distribute).to.have.been.called.once
        expect(artilleryTask.invoke).to.have.been.called.twice
        expect(artilleryTask.invoke).on.nth(1).be.called.with({ _test: 'frist' })
        expect(artilleryTask.invoke).on.nth(2).be.called.with({ _test: 'second' })
      })
  })

  it('uses aws lambda to distribute load', () => {
    sandbox.on(awsLambdaMock, 'invoke')

    const event = {
      _test: 'frist',
      _funcAws: {
        functionName: 'aws-function-name',
      },
    }

    return artilleryTask.invoke(event, 'invoke-type')
      .then(() => {
        expect(awsLambdaMock.invoke).to.have.been.called.once
        expect(awsLambdaMock.invoke).on.nth(1).be.called.with({
          FunctionName: event._funcAws.functionName, // eslint-disable-line no-underscore-dangle
          InvocationType: 'invoke-type',
          Payload: JSON.stringify(event),
        })
      })
  })

  it('executes with environment and removes entry from script', () => {
    const runStub = spy(defaultArtilleryRun)

    sandbox.on(artilleryTask, 'execute')
    sandbox.on(artilleryRun, 'run', runStub)

    return artilleryTask.executeAll({}, {}, [{ environment: 'test' }])
      .then(() => {
        expect(artilleryTask.execute).to.have.been.called.once
        expect(artilleryRun.run).to.have.been.called.once
        expect(runStub.calledWith(match.array)).to.be.ok
        const callArgs = runStub.getCall(0).args[0]
        expect(callArgs[0]).to.be.equal('--output')
        expect(callArgs[1]).to.be.a('string')
        expect(callArgs[2]).to.be.equal('--environment')
        expect(callArgs[3]).to.be.equal('test')
      })
  })

  it('executes without environment', () => {
    const runStub = spy(defaultArtilleryRun)

    sandbox.on(artilleryTask, 'execute')
    sandbox.on(artilleryRun, 'run', runStub)

    return artilleryTask.executeAll({}, {}, [{}])
      .then(() => {
        expect(artilleryTask.execute).to.have.been.called.once
        expect(artilleryRun.run).to.have.been.called.once
        expect(runStub.calledWith(match.array)).to.be.ok
        const callArgs = runStub.getCall(0).args[0]
        expect(callArgs[0]).to.be.equal('--output')
        expect(callArgs[1]).to.be.a('string')
        expect(callArgs[2]).to.be.a('string')
      })
  })

  afterEach(() => sandbox.restore())
})
