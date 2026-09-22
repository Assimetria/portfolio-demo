const NodeCache = require('node-cache')
// Default: 5 min TTL, 10 min check period
const cache = new NodeCache({ stdTTL: 300, checkperiod: 600 })
module.exports = cache
