'use strict';
var Big = require('big.js');

function transaction(params) {
  var to = params.to;
  var value = params.value;
  var wallet = params.wallet;

  var error;
  if (!/^(0x)[0-9a-f]{40}$/i.test(to)) {
    throw new Error('Invalid address');
  }
  if (value < 0) {
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

  var fee = wallet.getDefaultFee();
  var needed = Big(value).plus(fee);
  var pendingSpends = wallet.getPendingSpends();
  var has = confirmedBalance.minus(pendingSpends);

  if (has.lt(needed)) {
    error = new Error('Insufficient funds');

    if (balance.gte(needed)) {
      error.details = 'Additional funds confirmation pending';
    } else if (balance.gte(value)) {
      error.details = 'Attempt to empty wallet';
      error.sendableBalance = Math.max(balance.minus(fee), 0);
    }

    throw error;
  }
}

module.exports = {
  transaction: transaction
};
