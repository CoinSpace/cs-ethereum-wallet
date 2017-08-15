'use strict';
require('es6-promise').polyfill();

var getRequest = require('./utils').getRequest;

function Common(url) {
  this.url = url;
}

/**
 * request gasPrice
 *
 * @returns {axios.Promise}
 */
Common.prototype.gasPrice = function() {
  var self = this;
  return getRequest(self.url + 'gasPrice').then(function(data) {
    return Promise.resolve(data.price);
  });
};

module.exports = Common;
