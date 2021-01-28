'use strict';

const { postRequest } = require('./utils');
const { getRequest } = require('./utils');

class Transactions {
  constructor(url) {
    this.url = url;
  }
  /**
   * request information about transaction
   *
   * @param txId
   * @returns {axios.Promise}
   */
  get(txId) {
    return validateTxId(txId).then(() => {
      return getRequest(this.url + 'tx/' + txId);
    }).then((data) => {
      return Promise.resolve(data.tx);
    });
  }
  /**
   * post raw transaction
   *
   * @param rawtx
   * @returns {axios.Promise}
   */
  propagate(rawtx) {
    return postRequest(this.url + 'tx/send', { rawtx })
      .then((data) => {
        return Promise.resolve(data.txId);
      });
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
