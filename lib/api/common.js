import Base from './base.js';

export default class Common extends Base {
  /**
   * request gasPrice
   *
   * @returns {axios.Promise}
   */
  gasPrice() {
    return this.requestNode({
      url: 'api/v1/gasPrice',
      method: 'get',
    }).then((data) => data.price);
  }
  /**
   * request gasFees
   *
   * @returns {axios.Promise}
   */
  gasFees() {
    return this.requestNode({
      url: 'api/v1/gasFees',
      method: 'get',
    });
  }
}
