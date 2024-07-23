/* eslint-disable no-return-assign, no-nested-ternary */
const { CloudWatchLogs } = require('@aws-sdk/client-cloudwatch-logs') // eslint-disable-line import/no-extraneous-dependencies

module.exports = (
  logGroupName,
  cloudWatchLogs = new CloudWatchLogs(),
  log = console.log
) => ({
  recordRequest: (path) => log(`REQUEST ${path}`),
  getRequests: (path) => {
    const params = {
      logGroupName,
      filterPattern: `REQUEST ${path}`,
    }

    let allRequests = []

    const query = (p) => cloudWatchLogs.filterLogEvents(p)
      .then((logEvents) => {
        const pathRequests = logEvents.events.map((event) => {
          const { timestamp } = event

          return {
            path,
            timestamp,
          }
        })

        allRequests = allRequests.concat(pathRequests)

        return logEvents
      })

    const queryAll = (p) => query(p)
      .then((logEvents) => {
        if (logEvents.nextToken !== undefined) {
          const updatedParams = { ...p, nextToken: logEvents.nextToken }
          return queryAll(updatedParams)
        } else {
          return JSON.stringify(allRequests)
        }
      })

    return queryAll(params)
  },
})
