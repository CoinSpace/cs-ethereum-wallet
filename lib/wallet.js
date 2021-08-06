'use strict';

const hdkey = require('ethereumjs-wallet/hdkey');
const EthereumWallet = require('ethereumjs-wallet');
const EthereumTx = require('ethereumjs-tx').Transaction;
const EthereumCommon = require('ethereumjs-common').default;
const Big = require('big.js');
const BN = require('bn.js');
const API = require('./api');
const validator = require('./validator');
const Iban = require('./iban');
const ethUtil = require('ethereumjs-util');
const helpers = require('./helpers');
// var transferTokenHash = ethUtil.keccak('transfer(address,uint256)').toString('hex').substr(0, 8);
const transferTokenHash = 'a9059cbb';

class Wallet {
  constructor(options) {
    if (!options) {
      return this;
    }

    const { seed } = options;
    const { publicKey } = options;

    this.networkName = options.networkName;
    this.api = new API();
    this.decimals = options.decimals;
    this.balance = 0;
    this.confirmedBalance = 0;
    this.txsCursor = undefined;
    this.txsCount = 0;
    this.gasPrice = '0';
    this.maxGasPrice = '0';
    this.gasLimit = options.token ? '200000' : '21000';
    this.minConf = options.minConf || 5;
    this.token = options.token;
    this.isLocked = !seed;
    this.denomination = options.token ? options.token.symbol : 'ETH';
    this.baseDenomination = 'ETH';
    this.name = options.name || 'Ethereum';
    this.replaceByFeeFactor = options.replaceByFeeFactor || 1.2;

    if (options.useTestNetwork) {
      this.chainId = 1337;
    } else {
      this.chainId = options.chainId || 1;
    }

    try {
      this.common = new EthereumCommon(this.chainId, 'petersburg');
    } catch (e) {
      this.common = EthereumCommon.forCustomChain('mainnet', {
        name: 'dev',
        networkId: this.chainId,
        chainId: this.chainId,
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
  async load() {
    let promises;
    if (this.token) {
      promises = [
        this.api.tokens.balance(this.token.address, this.addressString, this.minConf),
        this.api.addresses.txsCount(this.addressString),
        this.api.common.gasPrice(),
        this.api.addresses.balance(this.addressString, this.minConf),
      ];
    } else {
      promises = [
        this.api.addresses.balance(this.addressString, this.minConf),
        this.api.addresses.txsCount(this.addressString),
        this.api.common.gasPrice(),
      ];
    }

    const results = await Promise.all(promises);
    this.balance = results[0].balance;
    this.confirmedBalance = results[0].confirmedBalance;
    this.txsCount = results[1];
    this.gasPrice = results[2];
    this.maxGasPrice = Big(this.gasPrice).times(100).toFixed(0);
    if (this.token) {
      this.ethBalance = helpers.min(results[3].confirmedBalance, results[3].balance);
    }
  }
  async update() {
    this.gasPrice = await this.api.common.gasPrice();
  }
  async loadTxs() {
    const data = this.token
      ? await this.api.tokens.txs(this.token.address, this.addressString, this.txsCursor)
      : await this.api.addresses.txs(this.addressString, this.txsCursor);
    data.txs = transformTxs(this, data.txs);
    this.txsCursor = data.cursor;
    return data;
  }
  lock() {
    this.etherWallet._privKey = null;
    this.isLocked = true;
  }
  unlock(seed) {
    this.etherWallet = hdkey.fromMasterSeed(seed).getWallet();
    this.isLocked = false;
  }
  publicKey() {
    return this.etherWallet.pubKey.toString('hex');
  }
  getNextAddress() {
    return this.addressString;
  }
  createTx(to, value) {
    validator.transaction({
      wallet: this,
      to,
      value,
    });

    const params = {
      nonce: new BN(this.txsCount),
      gasPrice: new BN(this.gasPrice),
      gasLimit: new BN(this.gasLimit),
    };

    if (this.token) {
      params.to = this.token.address;
      params.value = new BN(0);
      params.data = '0x' + transferTokenHash;
      params.data += helpers.padLeft(to.substr(2), 32);
      params.data += helpers.padLeft(new BN(value).toString(16), 32);
    } else {
      params.to = to;
      params.value = new BN(value);
    }
    const tx = new EthereumTx(params, { common: this.common });
    const that = this;
    return {
      sign() {
        tx.sign(that.etherWallet.getPrivateKey());
        return tx;
      },
    };
  }
  createReplacement(tx) {
    const that = this;
    let gasPrice = Big(tx.gasPrice).times(that.replaceByFeeFactor).toFixed(0);
    if (gasPrice === tx.gasPrice) {
      gasPrice = Big(gasPrice).plus(1).toFixed(0);
    }
    const fee = Big(tx.gasLimit).times(gasPrice);
    const oldFee = Big(tx.gasLimit).times(tx.gasPrice);
    const amount = fee.minus(oldFee).toFixed(0);
    validator.replacement({
      wallet: this,
      amount,
    });
    const params = {
      nonce: new BN(tx.nonce),
      gasPrice: new BN(gasPrice),
      gasLimit: new BN(tx.gasLimit),
      to: tx.to,
      value: new BN(tx.value),
      data: tx.input,
    };
    const replacementTx = new EthereumTx(params, { common: this.common });
    return {
      amount,
      sign() {
        replacementTx.sign(that.etherWallet.getPrivateKey());
        replacementTx.replaceByFeeTx = tx;
        return replacementTx;
      },
    };
  }
  get defaultFee() {
    return Big(this.gasLimit).times(this.gasPrice);
  }
  get maxAmount() {
    const fee = this.token ? 0 : this.defaultFee;
    const balance = Big(this.balance).minus(fee);
    return helpers.max(balance, 0);
  }
  async sendTx(tx) {
    const rawtx = '0x' + tx.serialize().toString('hex');
    const txId = await this.api.transactions.propagate(rawtx);
    tx.txId = txId;
    if (this.token) {
      return this.processTokenTx(tx);
    } else {
      return this.processTx(tx);
    }
  }
  async processTx(tx) {
    let historyTx = await this.api.transactions.get(tx.txId, this.addressString);
    const { replaceByFeeTx } = tx;
    if (replaceByFeeTx) {
      this.balance = Big(this.balance).minus(replaceByFeeTx.amount).plus(replaceByFeeTx.maxFee).toFixed(0);
    }
    historyTx = transformTxs(this, historyTx);
    const fee = historyTx.from === this.addressString ? historyTx.maxFee : 0;
    this.balance = Big(this.balance).plus(historyTx.amount).minus(fee).toFixed(0);
    if (historyTx.from === this.addressString && !replaceByFeeTx) {
      this.txsCount++;
    }
    return historyTx;
  }
  async processTokenTx(tx) {
    const value = new BN(tx.data.slice(36));
    const fee = new BN(tx.gasLimit).mul(new BN(tx.gasPrice));
    this.balance = new BN(this.balance).sub(value).toString(10);
    this.ethBalance = new BN(this.ethBalance).sub(fee).toString(10);
    this.txsCount++;
    return false;
  }
  isValidIban(str) {
    return Iban.isValid(str);
  }
  getAddressFromIban(str) {
    return new Iban(str).address();
  }
  createPrivateKey(str) {
    if (str.indexOf('0x') === 0) {
      str = str.substr(2);
    }
    const privateKey = Buffer.from(str, 'hex');
    if (!ethUtil.isValidPrivate(privateKey)) {
      throw new Error('Invalid private key');
    }
    return privateKey;
  }
  createImportTx(options) {
    const amount = Big(options.amount).minus(this.defaultFee);
    if (amount.lt(0)) {
      throw new Error('Insufficient funds');
    }
    const tx = new EthereumTx({
      nonce: options.txsCount,
      gasPrice: new BN(this.gasPrice),
      gasLimit: new BN(this.gasLimit),
      to: options.to,
      value: new BN(amount.toFixed(0)),
    }, { common: this.common });
    return {
      sign() {
        tx.sign(options.privateKey);
        return tx;
      },
    };
  }
  getImportTxOptions(privateKey) {
    const publicKey = ethUtil.privateToPublic(privateKey);
    const address = ethUtil.bufferToHex(ethUtil.pubToAddress(publicKey));
    return Promise.all([
      this.api.addresses.balance(address, this.minConf),
      this.api.addresses.txsCount(address),
    ]).then((results) => {
      return {
        privateKey,
        amount: helpers.min(results[0].confirmedBalance, results[0].balance),
        txsCount: results[1],
      };
    });
  }
  exportPrivateKeys() {
    let str = 'address,privatekey\n';
    str += this.addressString + ',' + this.etherWallet.getPrivateKeyString().substr(2);
    return str;
  }
  serialize() {
    return JSON.stringify({
      networkName: this.networkName,
      balance: this.balance,
      confirmedBalance: this.confirmedBalance,
      txsCount: this.txsCount,
      privateKey: this.etherWallet.getPrivateKeyString(),
      addressString: this.etherWallet.getAddressString(),
      gasPrice: this.gasPrice,
      gasLimit: this.gasLimit,
      minConf: this.minConf,
      chainId: this.common ? this.common.chainId() : 1,
    });
  }
  static deserialize(json) {
    const wallet = new Wallet();
    const deserialized = JSON.parse(json);
    const privateKey = wallet.createPrivateKey(deserialized.privateKey);

    wallet.networkName = deserialized.networkName;
    wallet.api = new API();
    wallet.balance = deserialized.balance;
    wallet.confirmedBalance = deserialized.confirmedBalance;
    wallet.txsCount = deserialized.txsCount;
    wallet.etherWallet = EthereumWallet.fromPrivateKey(privateKey);
    wallet.addressString = deserialized.addressString;
    wallet.gasPrice = deserialized.gasPrice;
    wallet.maxGasPrice = deserialized.maxGasPrice;
    wallet.gasLimit = deserialized.gasLimit;
    wallet.minConf = deserialized.minConf;
    const { chainId } = deserialized;
    try {
      wallet.common = new EthereumCommon(chainId, 'petersburg');
    } catch (e) {
      wallet.common = EthereumCommon.forCustomChain('mainnet', {
        name: 'dev',
        networkId: chainId,
        chainId,
      }, 'petersburg');
    }
    return wallet;
  }
}

function transformTxs(wallet, txs) {
  const address = wallet.addressString;
  if (Array.isArray(txs)) {
    return txs.map((tx) => {
      return transformTx(address, tx);
    });
  } else {
    return transformTx(address, txs);
  }
  function transformTx(address, tx) {
    let amount = tx.value;
    if (tx.from === tx.to) {
      amount = '0';
    } else if (tx.from === address) {
      amount = '-' + tx.value;
    }
    const isIncoming = tx.to === address && tx.from !== tx.to;
    return {
      id: tx.token ? tx.txId : tx._id,
      amount,
      value: tx.value,
      timestamp: tx.timestamp * 1000,
      confirmations: tx.confirmations,
      fee: tx.gasUsed ? (Big(tx.gasUsed).times(tx.gasPrice).toFixed(0)) : -1,
      maxFee: tx.gas ? Big(tx.gas).times(tx.gasPrice).toFixed(0) : 0,
      gasPrice: tx.gasPrice,
      gasLimit: tx.gas,
      status: tx.status === null ? true : tx.status,
      from: tx.from,
      to: tx.to,
      token: tx.token,
      isIncoming,
      nonce: tx.nonce,
      input: tx.input,
      isRBF: tx.confirmations === 0 && Big(tx.gasPrice).times(wallet.replaceByFeeFactor).lt(wallet.maxGasPrice),
    };
  }
}

module.exports = Wallet;
