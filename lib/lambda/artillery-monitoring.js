const sampling = require('./sampling')
const planning = require('./planning')
const analysis = require('./analysis')
const alert = require('./alert')

const artilleryMonitoring = (artillery) => ({
  execute: (timeNow, script, settings) => {
    const monitorScript = sampling.applyMonitoringSamplingToScript(script, settings)

    const plans = planning.planSamples(timeNow, monitorScript, settings)

    return artillery.executeAll(monitorScript, settings, plans, timeNow)
      .then((results) => analysis.analyzeMonitoring(timeNow, script, settings, results))
      .then((monitoringResults) => {
        if (monitoringResults.errorMessage) {
          return alert.send(script, monitoringResults)
            .then(() => monitoringResults)
        }

        return monitoringResults
      })
  },
})

module.exports = artilleryMonitoring
