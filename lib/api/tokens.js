'use strict';
require('es6-promise').polyfill();

var getRequest = require('./utils').getRequest;
var promiseWhile = require('./utils').promiseWhile;

function Tokens(url) {
  this.url = url;
}

/**
 * check whether address is correct
 *
 * @private
 * @param address
 * @returns {Promise}
 */
function validateAddress(address) {
  return new Promise(function(resolve, reject) {
    if (!/^(0x)[0-9a-f]{40}$/i.test(address)) {
      reject(new Error(address + ' is not a valid address'));
    } else {
      resolve();
    }
  });
}

/**
 * returns token balance
 *
 * @param tokenAddress
 * @param address
 * @param confirmations
 * @returns {axios.Promise}
 */
Tokens.prototype.balance = function(tokenAddress, address, confirmations) {
  var self = this;
  return Promise.all([
    validateAddress(tokenAddress),
    validateAddress(address)
  ]).then(function() {
    return getRequest(self.url + 'token/' + tokenAddress + '/' + address + '/balance', {
      confirmations: confirmations
    });
  });
};

/**
 * returns token txs
 *
 * @param tokenAddress
 * @param address
 * @returns {axios.Promise}
 */
Tokens.prototype.txs = function(tokenAddress, address) {
  var self = this;
  var chunkSize = 100;
  var to = chunkSize;
  var from = 0;

  var txs = [];
  var sliceLength = 0;
  var initial = true;

  return Promise.all([
    validateAddress(tokenAddress),
    validateAddress(address)
  ]).then(function() {
    return promiseWhile(function() {
      return initial || sliceLength === chunkSize;
    }, function() {
      initial = false;
      return getRequest(self.url + 'token/' + tokenAddress + '/' + address + '/txs', {from: from, to: to})
        .then(function(data) {
          sliceLength = data.txs.length;
          if (sliceLength !== 0) {
            txs = txs.concat(data.txs);
          }
          from = to;
          to += chunkSize;
        });
    });
  }).then(function() {
    return Promise.resolve(txs);
  });
};

module.exports = Tokens;
