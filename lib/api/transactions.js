'use strict';

class Transactions {
  constructor(api) {
    this.api = api;
  }
  /**
   * request information about transaction
   *
   * @param txId
   * @returns {axios.Promise}
   */
  get(txId) {
    return validateTxId(txId).then(() => {
      return this.api.requestNode({
        url: `api/v1/tx/${txId}`,
        method: 'get',
      });
    }).then((data) => data.tx);
  }
  /**
   * post raw transaction
   *
   * @param rawtx
   * @returns {axios.Promise}
   */
  propagate(rawtx) {
    return this.api.requestNode({
      url: 'api/v1/tx/send',
      data: {
        rawtx,
      },
      method: 'post',
    }).then((data) => data.txId);
  }
}

/**
 * check whether txId is correct
 *
 * @private
 * @param txId
 * @returns {Promise}
 */
function validateTxId(txId) {
  return new Promise((resolve, reject) => {
    if (!/^0x[0-9a-f]{64}$/i.test(txId)) {
      reject(new Error(txId + ' is not a valid txId'));
    } else {
      resolve();
    }
  });
}

module.exports = Transactions;
