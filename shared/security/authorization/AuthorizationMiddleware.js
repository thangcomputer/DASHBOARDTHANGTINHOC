'use strict'; 
const PolicyEvaluator = require('./PolicyEvaluator');
class AuthorizationMiddleware {
  static enforce(policy) {
    return (req, res, next) => { next(); }; // Mock
  }
}
module.exports = AuthorizationMiddleware;