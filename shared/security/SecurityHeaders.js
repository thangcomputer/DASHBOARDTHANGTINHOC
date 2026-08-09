'use strict';
const helmet = require('helmet');
const config = require('../../config/security');
module.exports = helmet(config.helmet);