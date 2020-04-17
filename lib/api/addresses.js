'use strict';

var getRequest = require('./utils').getRequest;

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
      reject(new Error(address + ' is not a valid address'));
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
    return getRequest(self.url + 'addr/' + address + '/balance', {
      confirmations: confirmations
    });
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
 * @param address
 * @param cursor
 * @returns {axios.Promise}
 */
Addresses.prototype.txs = function(address, cursor) {
  var self = this;
  return validateAddress(address).then(function() {
    return getRequest(self.url + 'addr/' + address + '/txs', {cursor: cursor})
      .then(function(data) {
        var hasMoreTxs = data.txs.length >= data.limit;
        var cursor;
        if (hasMoreTxs) {
          var lastTx = data.txs[data.txs.length - 1];
          cursor = lastTx.blockNumber + ':' + lastTx._id + ':' + lastTx.callIndex;
        }
        return {
          txs: data.txs,
          hasMoreTxs: hasMoreTxs,
          cursor: cursor
        };
      });
  });
};

module.exports = Addresses;
