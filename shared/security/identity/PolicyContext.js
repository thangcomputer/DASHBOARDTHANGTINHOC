'use strict'; 
class PolicyContext {
  constructor(user, tenant, branch, resource, request) {
    this.user = user; this.tenant = tenant; this.branch = branch; this.resource = resource; this.request = request;
  }
}
module.exports = PolicyContext;