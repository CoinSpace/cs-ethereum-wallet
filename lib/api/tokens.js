import Base from './base.js';

export default class Tokens extends Base {
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
      return this.requestNode({
        url: `api/v1/token/${tokenAddress}/${address}/balance`,
        method: 'get',
        params: { confirmations },
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
      return this.requestNode({
        url: `api/v1/token/${tokenAddress}/${address}/txs`,
        method: 'get',
        params: { cursor },
      })
        .then((data) => {
          const hasMoreTxs = data.txs.length >= data.limit;
          if (hasMoreTxs) cursor++;
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
