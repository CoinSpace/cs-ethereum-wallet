'use strict';

var Addresses = require('./addresses');
var Transactions = require('./transactions');
var Common = require('./common');
var utils = require('./utils');

function API() {
  // eslint-disable-next-line no-undef
  var baseURL = process.env.API_ETH_URL;
  this.addresses = new Addresses(baseURL);
  this.transactions = new Transactions(baseURL);
  this.common = new Common(baseURL);
  this.utils = utils;
}

module.exports = API;
