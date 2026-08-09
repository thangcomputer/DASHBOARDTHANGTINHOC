const { AsyncLocalStorage } = require('async_hooks');

const correlationContext = new AsyncLocalStorage();

module.exports = correlationContext;
