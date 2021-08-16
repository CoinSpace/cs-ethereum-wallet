'use strict';

class Addresses {
  constructor(api) {
    this.api = api;
  }
  /**
   * returns address balance
   *
   * @param address
   * @param confirmations
   * @returns {axios.Promise}
   */
  balance(address, confirmations) {
    return validateAddress(address).then(() => {
      return this.api.requestNode({
        url: `api/v1/addr/${address}/balance`,
        method: 'get',
        params: { confirmations },
      });
    });
  }
  /**
   * returns address txs count
   *
   * @param ids
   * @returns {axios.Promise}
   */
  txsCount(address) {
    return validateAddress(address).then(() => {
      return this.api.requestNode({
        url: `api/v1/addr/${address}/txsCount`,
        method: 'get',
      });
    }).then((data) => data.count);
  }
  /**
   * returns address txs
   *
   * @param address
   * @param cursor
   * @returns {axios.Promise}
   */
  txs(address, cursor) {
    return validateAddress(address).then(() => {
      return this.api.requestNode({
        url: `api/v1/addr/${address}/txs`,
        method: 'get',
        params: { cursor },
      })
        .then((data) => {
          const hasMoreTxs = data.txs.length >= data.limit;
          let cursor;
          if (hasMoreTxs) {
            const lastTx = data.txs[data.txs.length - 1];
            cursor = lastTx.blockNumber + ':' + lastTx._id + ':' + lastTx.callIndex;
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

module.exports = Addresses;
