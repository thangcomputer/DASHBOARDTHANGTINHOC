'use strict';
const CommandBus = require('./CommandBus');
const CommandRegistry = require('./CommandRegistry');
const QueryBus = require('./QueryBus');
const QueryRegistry = require('./QueryRegistry');
const EventBus = require('../events/EventBus');
const EventRegistry = require('../events/EventRegistry');
const EventDispatcher = require('../events/EventDispatcher');


const Metrics = require('../observability/Metrics');
const Tracer = require('../observability/Tracer');

const commandHooks = [{
  beforeExecute: async (cmd) => {
    Metrics.inc('command_total', { name: cmd.constructor.name });
  },
  afterExecute: async (cmd, result) => {
    // Tracer handles timing if wrapped
  },
  onError: async (cmd, err) => {
    err.isCommandError = true;
  }
}];

const queryHooks = [{
  beforeExecute: async (query) => {
    Metrics.inc('query_total', { name: query.constructor.name });
  },
  onError: async (query, err) => {
    err.isQueryError = true;
  }
}];

const eventHooks = [{
  beforeExecute: async (event) => {
    Metrics.inc('event_total', { name: event.eventName });
  }
}];

const commandRegistry = new CommandRegistry();
const queryRegistry = new QueryRegistry();
const eventRegistry = new EventRegistry();
const eventDispatcher = new EventDispatcher(eventRegistry);

const eventBus = new EventBus(eventDispatcher, eventHooks);
const commandBus = new CommandBus(commandRegistry, commandHooks);
const queryBus = new QueryBus(queryRegistry, queryHooks);


module.exports = { commandBus, commandRegistry, queryBus, queryRegistry, eventBus, eventRegistry };
