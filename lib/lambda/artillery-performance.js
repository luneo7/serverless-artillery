const planning = require('./planning')
const analysis = require('./analysis')

const artilleryPerformance = (artilleryTask) => ({
  execute: (timeNow, script, settings) => {
    const plans = planning.planPerformance(timeNow, script, settings)

    return artilleryTask.executeAll(script, settings, plans, timeNow)
      .then((results) => analysis.analyzePerformance(timeNow, script, settings, results))
  },
})

module.exports = artilleryPerformance
