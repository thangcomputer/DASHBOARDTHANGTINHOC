'use strict';
// Schema definitions for Mongo, Redis, JWT, SMTP, etc.
module.exports = {
  mongoSchema: { uri: 'string', required: true },
  jwtSchema: { secret: 'string', required: true }
};