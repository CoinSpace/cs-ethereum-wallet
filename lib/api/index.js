'use strict';

const Addresses = require('./addresses');
const Tokens = require('./tokens');
const Transactions = require('./transactions');
const Common = require('./common');

class API {
  constructor(options) {
    this.addresses = new Addresses(this);
    this.tokens = new Tokens(this);
    this.transactions = new Transactions(this);
    this.common = new Common(this);
    this.options = options;
  }

  requestNode(config) {
    return this.options.request({
      ...config,
      baseURL: this.options.apiNode,
      disableDefaultCatch: true,
      seed: 'public',
    }).catch((err) => {
      const message = err.response && err.response.data;
      if (/Gas limit is too low/.test(message)) throw new Error('Gas limit is too low');
      console.error(err);
      throw new Error('cs-node-error');
    });
  }
}

module.exports = API;
