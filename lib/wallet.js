'use strict';

var hdkey = require('ethereumjs-wallet/hdkey');
var EthereumWallet = require('ethereumjs-wallet');
var EthereumTx = require('ethereumjs-tx').Transaction;
var EthereumCommon = require('ethereumjs-common').default;
var Big = require('big.js');
var BN = require('bn.js');
var API = require('./api');
var validator = require('./validator');
var Iban = require('./iban');
var ethUtil = require('ethereumjs-util');
var helpers = require('./helpers');
// var transferTokenHash = ethUtil.keccak('transfer(address,uint256)').toString('hex').substr(0, 8);
var transferTokenHash = 'a9059cbb';
var names = {
  ETH: 'Ethereum',
  USDT: 'Tether USD',
};

function Wallet(options) {
  if (arguments.length === 0) return this;

  var seed = options.seed;
  var publicKey = options.publicKey;

  this.networkName = options.networkName;
  this.api = new API();
  this.balance = 0;
  this.confirmedBalance = 0;
  this.txsCursor = undefined;
  this.txsCount = 0;
  this.gasPrice = '0';
  this.gasLimit = options.token ? '200000' : '21000';
  this.minConf = options.minConf || 5;
  this.token = options.token;
  this.isLocked = !seed;
  this.denomination = options.token ? options.token.symbol : 'ETH';
  this.name = names[this.denomination] || this.denomination;

  var chainId = options.chainId || 1;
  try {
    this.common = new EthereumCommon(chainId, 'petersburg');
  } catch (e) {
    this.common = EthereumCommon.forCustomChain('mainnet', {
      name: 'dev',
      networkId: chainId,
      chainId: chainId
    }, 'petersburg');
  }

  if (seed) {
    this.etherWallet = hdkey.fromMasterSeed(seed).getWallet();
  } else if (publicKey) {
    this.etherWallet = EthereumWallet.fromPublicKey(Buffer.from(publicKey, 'hex'));
  } else {
    throw new Error('seed or publicKey should be passed');
  }
  this.addressString = this.etherWallet.getAddressString();
}

Wallet.prototype.load = function(options) {
  var done = options.done;
  var that = this;

  var promises;
  if (that.token) {
    promises = [
      that.api.tokens.balance(that.token.address, that.addressString, that.minConf),
      that.api.addresses.txsCount(that.addressString),
      that.api.common.gasPrice(),
      that.api.addresses.balance(that.addressString, that.minConf)
    ];
  } else {
    promises = [
      that.api.addresses.balance(that.addressString, that.minConf),
      that.api.addresses.txsCount(that.addressString),
      that.api.common.gasPrice(),
    ];
  }

  Promise.all(promises).then(function(results) {
    that.balance = results[0].balance;
    that.confirmedBalance = results[0].confirmedBalance;
    that.txsCount = results[1];
    that.gasPrice = results[2];
    if (that.token) {
      that.ethBalance = helpers.min(results[3].confirmedBalance, results[3].balance);
    }

    done(null, that);
  }).catch(done);
};

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

Wallet.prototype.lock = function() {
  this.etherWallet._privKey = null;
  this.isLocked = true;
};

Wallet.prototype.unlock = function(seed) {
  this.etherWallet = hdkey.fromMasterSeed(seed).getWallet();
  this.isLocked = false;
};

Wallet.prototype.publicKey = function() {
  return this.etherWallet.pubKey.toString('hex');
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
    gasLimit: new BN(this.gasLimit)
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
  var tx = new EthereumTx(params, {common: this.common});
  var that = this;
  return {
    sign: function() {
      tx.sign(that.etherWallet.getPrivateKey());
      return tx;
    }
  };
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
    that.balance = Big(that.balance).plus(historyTx.amount).minus(historyTx.maxFee).toFixed();
    if (historyTx.from === that.addressString) {
      that.txsCount++;
    }
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
    if (tx.from === tx.to) {
      tx.value = '0';
    } else if (tx.from === address) {
      tx.value = '-' + tx.value;
    }
    return {
      id: tx.token ? tx.txId : tx._id,
      amount: tx.value,
      timestamp: tx.timestamp * 1000,
      confirmations: tx.confirmations,
      fee: tx.gasUsed ? (Big(tx.gasUsed).times(tx.gasPrice).toFixed()) : -1,
      maxFee: Big(tx.gas).times(tx.gasPrice).toFixed(),
      status: tx.status === null ? true : tx.status,
      from: tx.from,
      to: tx.to,
      token: tx.token,
      isIncoming: tx.to === address && tx.from !== tx.to
    };
  }
}

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
  var privateKey = Buffer.from(str, 'hex');
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
    value: new BN(amount.toFixed())
  }, {common: this.common});
  return {
    sign: function() {
      tx.sign(options.privateKey);
      return tx;
    }
  };
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
    txsCount: this.txsCount,
    privateKey: this.etherWallet.getPrivateKeyString(),
    addressString: this.etherWallet.getAddressString(),
    gasPrice: this.gasPrice,
    gasLimit: this.gasLimit,
    minConf: this.minConf,
    chainId: this.common ? this.common.chainId() : 1
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
  wallet.txsCount = deserialized.txsCount;
  wallet.etherWallet = EthereumWallet.fromPrivateKey(privateKey);
  wallet.addressString = deserialized.addressString;
  wallet.gasPrice = deserialized.gasPrice;
  wallet.gasLimit = deserialized.gasLimit;
  wallet.minConf = deserialized.minConf;
  var chainId = deserialized.chainId;
  try {
    wallet.common = new EthereumCommon(chainId, 'petersburg');
  } catch (e) {
    wallet.common = EthereumCommon.forCustomChain('mainnet', {
      name: 'dev',
      networkId: chainId,
      chainId: chainId
    }, 'petersburg');
  }
  return wallet;
};

module.exports = Wallet;
