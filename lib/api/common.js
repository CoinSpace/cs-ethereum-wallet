'use strict';

const { getRequest } = require('./utils');

class Common {
  constructor(url) {
    this.url = url;
  }
  /**
   * request gasPrice
   *
   * @returns {axios.Promise}
   */
  gasPrice() {
    return getRequest(this.url + 'gasPrice').then((data) => {
      return Promise.resolve(data.price);
    });
  }
}

module.exports = Common;
