'use strict';

const Addresses = require('./addresses');
const Tokens = require('./tokens');
const Transactions = require('./transactions');
const Common = require('./common');
const utils = require('./utils');

class API {
  constructor() {
    // eslint-disable-next-line no-undef
    const baseURL = process.env.API_ETH_URL;
    this.addresses = new Addresses(baseURL);
    this.tokens = new Tokens(baseURL);
    this.transactions = new Transactions(baseURL);
    this.common = new Common(baseURL);
    this.utils = utils;
  }
}

module.exports = API;
