'use strict';
var Big = require('big.js');
var helpers = require('./helpers');

function transaction(params) {
  var to = params.to;
  var value = params.value;
  var wallet = params.wallet;

  var error;
  if (!/^(0x)[0-9a-f]{40}$/i.test(to)) {
    throw new Error('Invalid address');
  }
  if (value <= 0) {
    error = new Error('Invalid value');
    error.dustThreshold = 0;
    throw error;
  }
  var gasLimit = parseInt(wallet.gasLimit);
  if (isNaN(gasLimit) || gasLimit < 0) {
    throw new Error('Invalid gasLimit');
  }

  var balance = Big(wallet.getBalance());
  var confirmedBalance = Big(wallet.confirmedBalance);

  var fee = wallet.token ? 0 : wallet.getDefaultFee();
  var needed = Big(value).plus(fee);
  var has = helpers.min(confirmedBalance, balance);

  if (has.lt(needed)) {
    error = new Error('Insufficient funds');

    if (balance.gte(needed)) {
      error.details = 'Additional funds confirmation pending';
    } else {
      error.details = 'Attempt to empty wallet';
      error.sendableBalance = helpers.max(balance.minus(fee), 0);
    }

    throw error;
  }

  if (wallet.token) {
    var ethFee = wallet.getDefaultFee();
    if (Big(wallet.ethBalance).lt(ethFee)) {
      error = new Error('Insufficient ethereum funds for token transaction');
      error.ethereumRequired = ethFee;
      throw error;
    }
  }
}

module.exports = {
  transaction: transaction
};
