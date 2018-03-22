'use strict';
require('es6-promise').polyfill();

var postRequest = require('./utils').postRequest;
var getRequest = require('./utils').getRequest;

function Transactions(url) {
  this.url = url;
}

/**
 * check whether txId is correct
 *
 * @private
 * @param txId
 * @returns {Promise}
 */
function validateTxId(txId) {
  return new Promise(function(resolve, reject) {
    if (!/^0x[0-9a-f]{64}$/i.test(txId)) {
      reject(new Error(txId + ' is not a valid txId'));
    } else {
      resolve();
    }
  });
}

/**
 * request information about transaction
 *
 * @param txId
 * @returns {axios.Promise}
 */
Transactions.prototype.get = function(txId) {
  var self = this;
  return validateTxId(txId).then(function() {
    return getRequest(self.url + 'tx/' + txId);
  }).then(function(data) {
    return Promise.resolve(data.tx);
  });
};

/**
 * post raw transaction
 *
 * @param rawtx
 * @returns {axios.Promise}
 */
Transactions.prototype.propagate = function(rawtx) {
  return postRequest(this.url + 'tx/send', {rawtx: rawtx})
    .then(function(data) {
      return Promise.resolve(data.txId);
    });
};

module.exports = Transactions;
