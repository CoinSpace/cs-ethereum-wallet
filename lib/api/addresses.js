'use strict';
require('es6-promise').polyfill();

var getRequest = require('./utils').getRequest;
var promiseWhile = require('./utils').promiseWhile;

function Addresses(url) {
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
      reject({
        item: address,
        url: '',
        res: new Error(address + ' is not a valid address')
      });
    } else {
      resolve();
    }
  });
}

/**
 * returns address balance
 *
 * @param address
 * @param confirmations
 * @returns {axios.Promise}
 */
Addresses.prototype.balance = function(address, confirmations) {
  var self = this;
  return validateAddress(address).then(function() {
    return getRequest(self.url + 'addr/' + address + '/balance', {confirmations: confirmations});
  });
};

/**
 * returns address txs count
 *
 * @param ids
 * @returns {axios.Promise}
 */
Addresses.prototype.txsCount = function(address) {
  var self = this;
  return validateAddress(address).then(function() {
    return getRequest(self.url + 'addr/' + address + '/txsCount');
  }).then(function(data) {
    return Promise.resolve(data.count);
  });
};

/**
 * returns address txs
 *
 * @param ids
 * @returns {axios.Promise}
 */
Addresses.prototype.txs = function(address) {
  var self = this;
  var chunkSize = 100;
  var to = chunkSize;
  var from = 0;

  var txs = [];
  var sliceLength = 0;
  var initial = true;

  return validateAddress(address).then(function() {
    return promiseWhile(function() {
      return initial || sliceLength === chunkSize;
    }, function() {
      initial = false;
      return getRequest(self.url + 'addr/' + address + '/txs', {from: from, to: to})
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

module.exports = Addresses;
