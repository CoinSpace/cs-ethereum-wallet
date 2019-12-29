'use strict';

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
 * @param cursor
 * @returns {axios.Promise}
 */
Tokens.prototype.txs = function(tokenAddress, address, cursor) {
  var self = this;
  return Promise.all([
    validateAddress(tokenAddress),
    validateAddress(address)
  ]).then(function() {
    return getRequest(self.url + 'token/' + tokenAddress + '/' + address + '/txs', {cursor: cursor})
      .then(function(data) {
        var hasMoreTxs = data.txs.length >= data.limit;
        var cursor;
        if (hasMoreTxs) {
          var lastTx = data.txs[data.txs.length - 1];
          cursor = lastTx.blockNumber + ':' + lastTx.txId + ':' + lastTx.logIndex;
        }
        return {
          txs: data.txs,
          hasMoreTxs: hasMoreTxs,
          cursor: cursor
        };
      });
  });
};

module.exports = Tokens;
