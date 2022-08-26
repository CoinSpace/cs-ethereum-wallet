import Big from 'big.js';
import helpers from './helpers.js';

function transaction(params) {
  const { to, value, wallet } = params;

  let error;
  if (!/^(0x)[0-9a-f]{40}$/i.test(to)) {
    throw new Error('Invalid address');
  }
  if (value <= 1) {
    error = new Error('Invalid value');
    error.dustThreshold = 1;
    throw error;
  }
  const gasLimit = parseInt(wallet.gasLimit);
  if (isNaN(gasLimit) || gasLimit < 0) {
    throw new Error('Invalid gasLimit');
  }

  const balance = Big(wallet.balance);
  const confirmedBalance = Big(wallet.confirmedBalance);

  const fee = wallet.crypto.type === 'token' ? 0 : wallet.defaultFee;
  const needed = Big(value).plus(fee);
  const has = helpers.min(confirmedBalance, balance);

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

  if (wallet.crypto.type === 'token') {
    const ethFee = wallet.defaultFee;
    if (Big(wallet.ethBalance).lt(ethFee)) {
      error = new Error('Insufficient funds for token transaction');
      error.required = ethFee;
      throw error;
    }
  }
}

function replacement(params) {
  const { wallet, amount } = params;
  const balance = Big(wallet.balance);
  const confirmedBalance = Big(wallet.confirmedBalance);
  const has = helpers.min(confirmedBalance, balance);
  if (has.lt(amount)) {
    throw new Error('Insufficient funds');
  }
}

export default {
  transaction,
  replacement,
};
