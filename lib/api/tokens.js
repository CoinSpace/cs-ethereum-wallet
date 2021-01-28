'use strict';

const { getRequest } = require('./utils');

class Tokens {
  constructor(url) {
    this.url = url;
  }
  /**
   * returns token balance
   *
   * @param tokenAddress
   * @param address
   * @param confirmations
   * @returns {axios.Promise}
   */
  balance(tokenAddress, address, confirmations) {
    return Promise.all([
      validateAddress(tokenAddress),
      validateAddress(address),
    ]).then(() => {
      return getRequest(this.url + 'token/' + tokenAddress + '/' + address + '/balance', {
        confirmations,
      });
    });
  }
  /**
   * returns token txs
   *
   * @param tokenAddress
   * @param address
   * @param cursor
   * @returns {axios.Promise}
   */
  txs(tokenAddress, address, cursor) {
    return Promise.all([
      validateAddress(tokenAddress),
      validateAddress(address),
    ]).then(() => {
      return getRequest(this.url + 'token/' + tokenAddress + '/' + address + '/txs', { cursor })
        .then((data) => {
          const hasMoreTxs = data.txs.length >= data.limit;
          let cursor;
          if (hasMoreTxs) {
            const lastTx = data.txs[data.txs.length - 1];
            cursor = lastTx.blockNumber + ':' + lastTx.txId + ':' + lastTx.logIndex;
          }
          return {
            txs: data.txs,
            hasMoreTxs,
            cursor,
          };
        });
    });
  }
}

/**
 * check whether address is correct
 *
 * @private
 * @param address
 * @returns {Promise}
 */
function validateAddress(address) {
  return new Promise((resolve, reject) => {
    if (!/^(0x)[0-9a-f]{40}$/i.test(address)) {
      reject(new Error(address + ' is not a valid address'));
    } else {
      resolve();
    }
  });
}

module.exports = Tokens;
