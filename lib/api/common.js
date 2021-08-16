'use strict';

class Common {
  constructor(api) {
    this.api = api;
  }
  /**
   * request gasPrice
   *
   * @returns {axios.Promise}
   */
  gasPrice() {
    return this.api.requestNode({
      url: 'api/v1/gasPrice',
      method: 'get',
    }).then((data) => data.price);
  }
}

module.exports = Common;
