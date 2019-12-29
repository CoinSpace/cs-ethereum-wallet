'use strict';

var assert = require('assert');
var hdkey = require('ethereumjs-wallet/hdkey');
var EthereumWallet = require('ethereumjs-wallet');
var EthereumTx = require('ethereumjs-tx');
var Big = require('big.js');
var BN = require('bn.js');
var API = require('./api');
var validator = require('./validator');
var Iban = require('./iban');
var ethUtil = require('ethereumjs-util');
var helpers = require('./helpers');
var transferTokenHash = ethUtil.sha3('transfer(address,uint256)').toString('hex').substr(0, 8);

function Wallet(options) {
  if (arguments.length === 0) return this;

  var seed = options.seed;
  var done = options.done;
  var txDone = options.txDone ? options.txDone : function() {};

  try {
    assert(seed, 'seed cannot be empty');
  } catch (err) {
    return doneError(err);
  }

  this.networkName = options.networkName;
  this.api = new API();
  this.balance = 0;
  this.confirmedBalance = 0;
  this.historyTxs = [];
  this.hasMoreTxs = false;
  this.txsCursor = undefined;
  this.txsCount = 0;
  this.etherWallet = hdkey.fromMasterSeed(seed).getWallet();
  this.addressString = this.etherWallet.getAddressString();
  this.gasPrice = '0';
  this.gasLimit = options.token ? '200000' : '21000';
  this.minConf = options.minConf || 5;
  this.token = options.token;
  this.chainId = options.chainId || 1;

  var that = this;

  var promises;
  if (that.token) {
    promises = [
      that.api.tokens.balance(that.token.address, that.addressString, that.minConf),
      that.api.addresses.txsCount(that.addressString),
      that.api.common.gasPrice(),
      that.loadTxs(),
      that.api.addresses.balance(that.addressString, that.minConf)
    ];
  } else {
    promises = [
      that.api.addresses.balance(that.addressString, that.minConf),
      that.api.addresses.txsCount(that.addressString),
      that.api.common.gasPrice(),
      that.loadTxs()
    ];
  }

  Promise.all(promises).then(function(results) {
    that.balance = results[0].balance;
    that.confirmedBalance = results[0].confirmedBalance;
    that.txsCount = results[1];
    that.gasPrice = results[2];
    that.historyTxs = results[3].txs;
    that.hasMoreTxs = results[3].hasMoreTxs;
    if (that.token) {
      that.ethBalance = helpers.min(results[4].confirmedBalance, results[4].balance);
    }

    done(null, that);
    txDone(null, that);

  }).catch(doneError);

  function doneError(err) {
    done(err);
    txDone(err);
  }
}

Wallet.prototype.loadTxs = function() {
  var that = this;
  var promise;
  if (that.token) {
    promise = this.api.tokens.txs(that.token.address, that.addressString, that.txsCursor);
  } else {
    promise = this.api.addresses.txs(that.addressString, that.txsCursor);
  }
  return promise.then(function(data) {
    data.txs = transformTxs(that.addressString, data.txs);
    that.txsCursor = data.cursor;
    return data;
  });
};

Wallet.prototype.getBalance = function() {
  return this.balance;
};

Wallet.prototype.getNextAddress = function() {
  return this.addressString;
};

Wallet.prototype.createTx = function(to, value) {
  validator.transaction({
    wallet: this,
    to: to,
    value: value
  });

  var params = {
    nonce: this.txsCount,
    gasPrice: new BN(this.gasPrice),
    gasLimit: new BN(this.gasLimit),
    chainId: this.chainId
  };

  if (this.token) {
    params.to = this.token.address;
    params.value = 0;
    params.data = '0x' + transferTokenHash;
    params.data += helpers.padLeft(to.substr(2), 32);
    params.data += helpers.padLeft(new BN(value).toString(16), 32);
  } else {
    params.to = to;
    params.value = new BN(value);
  }
  var tx = new EthereumTx(params);
  tx.sign(this.etherWallet.getPrivateKey());
  return tx;
};

Wallet.prototype.getPendingSpends = function() {
  var that = this;
  return that.historyTxs.reduce(function(sum, tx) {
    if (tx.confirmations < that.minConf && tx.from === that.addressString) {
      var fee = that.token ? 0 : Big(tx.gas).times(tx.gasPrice);
      var amount = Big(tx.value).abs().plus(fee);
      return sum.plus(amount);
    }
    return sum;
  }, Big(0));
};

Wallet.prototype.getDefaultFee = function() {
  return Big(this.gasLimit).times(this.gasPrice);
};

Wallet.prototype.getMaxAmount = function() {
  var fee = this.token ? 0 : this.getDefaultFee();
  var balance = Big(this.balance).minus(fee);
  return helpers.max(balance, 0);
};

Wallet.prototype.sendTx = function(tx, done) {
  var that = this;
  var rawtx = '0x' + tx.serialize().toString('hex');
  that.api.transactions.propagate(rawtx).then(function(txId) {
    if (that.token) {
      that.processTokenTx(tx, done);
    } else {
      that.processTx(txId, done);
    }
  }).catch(done);
};

Wallet.prototype.processTx = function(txId, done) {
  var that = this;
  that.api.transactions.get(txId, that.addressString).then(function(historyTx) {
    historyTx = transformTxs(that.addressString, historyTx);
    var maxFee = Big(historyTx.gas).times(historyTx.gasPrice);
    that.balance = Big(that.balance).plus(historyTx.value).minus(maxFee).toFixed();
    if (historyTx.from === that.addressString) {
      that.txsCount++;
    }
    that.historyTxs.unshift(historyTx);
    done(null, historyTx);
  }).catch(done);
};

Wallet.prototype.processTokenTx = function(tx, done) {
  var value = new BN(tx.data.slice(36));
  var fee = new BN(tx.gasLimit).mul(new BN(tx.gasPrice));
  this.balance = new BN(this.balance).sub(value).toString(10);
  this.ethBalance = new BN(this.ethBalance).sub(fee).toString(10);
  done(null, false);
};

function transformTxs(address, txs) {
  if (Array.isArray(txs)) {
    return txs.map(function(tx) {
      return transformTx(address, tx);
    });
  } else {
    return transformTx(address, txs);
  }
  function transformTx(address, tx) {
    tx.fee = tx.gasUsed ? (Big(tx.gasUsed).times(tx.gasPrice).toFixed()) : -1;
    if (tx.from === address) {
      tx.value = '-' + tx.value;
    }
    if (tx.status === null) {
      tx.status = true;
    }
    return tx;
  }
}

Wallet.prototype.getTransactionHistory = function() {
  return this.historyTxs;
};

Wallet.prototype.isValidIban = function(str) {
  return Iban.isValid(str);
};

Wallet.prototype.getAddressFromIban = function(str) {
  return new Iban(str).address();
};

Wallet.prototype.createPrivateKey = function(str) {
  if (str.indexOf('0x') === 0) {
    str = str.substr(2);
  }
  var privateKey = new Buffer(str, 'hex');
  if (!ethUtil.isValidPrivate(privateKey)) {
    throw new Error('Invalid private key');
  }
  return privateKey;
};

Wallet.prototype.createImportTx = function(options) {
  var amount = Big(options.amount).minus(this.getDefaultFee());
  if (amount.lt(0)) {
    throw new Error('Insufficient funds');
  }
  var tx = new EthereumTx({
    nonce: options.txsCount,
    gasPrice: new BN(this.gasPrice),
    gasLimit: new BN(this.gasLimit),
    to: options.to,
    value: new BN(amount.toFixed()),
    chainId: this.chainId
  });
  tx.sign(options.privateKey);
  return tx;
};

Wallet.prototype.getImportTxOptions = function(privateKey) {
  var that = this;
  var publicKey = ethUtil.privateToPublic(privateKey);
  var address = ethUtil.bufferToHex(ethUtil.pubToAddress(publicKey));
  return Promise.all([
    that.api.addresses.balance(address, that.minConf),
    that.api.addresses.txsCount(address)
  ]).then(function(results) {
    return {
      privateKey: privateKey,
      amount: helpers.min(results[0].confirmedBalance, results[0].balance),
      txsCount: results[1]
    };
  });
};

Wallet.prototype.exportPrivateKeys = function() {
  var str = 'address,privatekey\n';
  str += this.addressString + ',' + this.etherWallet.getPrivateKeyString().substr(2);
  return str;
};

Wallet.prototype.serialize = function() {
  return JSON.stringify({
    networkName: this.networkName,
    balance: this.getBalance(),
    confirmedBalance: this.confirmedBalance,
    historyTxs: this.historyTxs,
    txsCount: this.txsCount,
    privateKey: this.etherWallet.getPrivateKeyString(),
    addressString: this.etherWallet.getAddressString(),
    gasPrice: this.gasPrice,
    gasLimit: this.gasLimit,
    minConf: this.minConf,
    chainId: this.chainId
  });
};

Wallet.deserialize = function(json) {
  var wallet = new Wallet();
  var deserialized = JSON.parse(json);
  var privateKey = wallet.createPrivateKey(deserialized.privateKey);

  wallet.networkName = deserialized.networkName;
  wallet.api = new API();
  wallet.balance = deserialized.balance;
  wallet.confirmedBalance = deserialized.confirmedBalance;
  wallet.historyTxs = deserialized.historyTxs;
  wallet.txsCount = deserialized.txsCount;
  wallet.etherWallet = EthereumWallet.fromPrivateKey(privateKey);
  wallet.addressString = deserialized.addressString;
  wallet.gasPrice = deserialized.gasPrice;
  wallet.gasLimit = deserialized.gasLimit;
  wallet.minConf = deserialized.minConf;
  wallet.chainId = deserialized.chainId;
  return wallet;
};

module.exports = Wallet;
