import HDKey from 'hdkey';
import EthereumWalletPkg from 'ethereumjs-wallet';
import CommonPkg, { Hardfork } from '@ethereumjs/common';
import EthereumTxPkg from '@ethereumjs/tx';
import Big from 'big.js';
import BN from 'bn.js';
import API from './api/index.js';
import validator from './validator.js';
import Iban from './iban.js';
import ethUtil from 'ethereumjs-util';
import helpers from './helpers.js';

const { default: EthereumWallet } = EthereumWalletPkg;
const { default: EthereumCommon } = CommonPkg;
const { FeeMarketEIP1559Transaction, Transaction } = EthereumTxPkg;

// var transferTokenHash = ethUtil.keccak('transfer(address,uint256)').toString('hex').substr(0, 8);
const transferTokenHash = 'a9059cbb';

class Wallet {
  #txUrl;
  static networks = {
    ethereum: {
      bip44: "m/44'/60'/0'",
      eip1559: true,
    },
    'ethereum-classic': {
      bip44: "m/44'/61'/0'",
    },
  };
  constructor(options) {
    if (!options) {
      return this;
    }

    const { seed, publicKey, crypto, platformCrypto, cache, settings } = options;

    this.crypto = crypto;
    this.platformCrypto = platformCrypto;
    this.cache = cache;
    this.settings = settings || {};
    this.network = Wallet.networks[this.platformCrypto.platform];

    this.settings.bip44 = this.settings.bip44 ||
      (this.platformCrypto._id === 'ethereum@ethereum' ? 'm' : this.network.bip44);

    this.api = new API({
      request: options.request,
      apiNode: options.apiNode,
    });
    this.balance = this.cache.get('balance') || 0;
    this.confirmedBalance = 0;
    this.txsCursor = 1;
    this.txsCount = 0;
    this.gasLimit = crypto.type === 'token' ? '200000' : '21000';
    if (this.network.eip1559) {
      this.gasFees = {
        maxPriorityFeePerGas: '0',
        maxFeePerGas: '0',
      };
    } else {
      this.gasPrice = '0';
    }
    this.maxReplaceByFeeGas = '0';
    this.minConf = options.minConf || 5;
    this.isLocked = !seed;
    this.replaceByFeeFactor = options.replaceByFeeFactor || 1.2;
    this.useTestNetwork = !!options.useTestNetwork;

    if (this.useTestNetwork) {
      if (this.platformCrypto._id === 'ethereum@ethereum') {
        this.chainId = 5;
        this.networkId = 5;
        this.#txUrl = 'https://goerli.etherscan.io/tx/${txId}';
      } else if (this.platformCrypto._id === 'ethereum-classic@ethereum-classic') {
        this.chainId = 63;
        this.networkId = 7;
        this.#txUrl = 'https://blockscout.com/etc/mordor/tx/${txId}';
      }
    } else {
      if (this.platformCrypto._id === 'ethereum@ethereum') {
        this.chainId = 1;
        this.networkId = 1;
        this.#txUrl = 'https://blockchair.com/ethereum/transaction/${txId}?from=coinwallet';
      } else if (this.platformCrypto._id === 'ethereum-classic@ethereum-classic') {
        this.chainId = 61;
        this.networkId = 1;
        this.#txUrl = 'https://blockscout.com/etc/mainnet/tx/${txId}';
      }
    }

    this.common = EthereumCommon.custom(
      { chainId: this.chainId, networkId: this.networkId },
      { eips: [1559], hardfork: Hardfork.London }
    );

    if (seed) {
      const hdkey = HDKey.fromMasterSeed(Buffer.from(seed, this.settings.bip44 === 'm' ? 'utf8' : 'hex'));
      const base = hdkey.derive(this.settings.bip44);
      this.etherWallet = EthereumWallet.fromPrivateKey(base._privateKey);
    } else if (publicKey) {
      const data = publicKey.startsWith('{') ? JSON.parse(publicKey) : publicKey;
      const pubKey = data.pubKey || data;
      this.etherWallet = EthereumWallet.fromPublicKey(Buffer.from(pubKey, 'hex'));
    } else {
      throw new Error('seed or publicKey should be passed');
    }
    this.addressString = this.etherWallet.getAddressString();
    this.checkSumAddressString = this.etherWallet.getChecksumAddressString();
  }
  async load() {
    let promises;
    if (this.crypto.type === 'token') {
      promises = [
        this.api.tokens.balance(this.crypto.address, this.addressString, this.minConf),
        this.api.addresses.txsCount(this.addressString),
        this.update(),
        this.api.addresses.balance(this.addressString, this.minConf),
      ];
    } else {
      promises = [
        this.api.addresses.balance(this.addressString, this.minConf),
        this.api.addresses.txsCount(this.addressString),
        this.update(),
      ];
    }

    const results = await Promise.all(promises);
    this.balance = results[0].balance;
    this.cache.set('balance', this.balance);
    this.txsCursor = 1;
    this.confirmedBalance = results[0].confirmedBalance;
    this.txsCount = results[1];
    if (this.crypto.type === 'token') {
      this.ethBalance = helpers.min(results[3].confirmedBalance, results[3].balance);
    }
  }
  async update() {
    if (this.network.eip1559) {
      this.gasFees = await this.api.common.gasFees();
      this.maxReplaceByFeeGas = Big(this.gasFees.maxFeePerGas).times(100).toFixed(0);
    } else {
      this.gasPrice = await this.api.common.gasPrice();
      this.maxReplaceByFeeGas = Big(this.gasPrice).times(100).toFixed(0);
    }
  }
  async loadTxs() {
    const data = this.crypto.type === 'token'
      ? await this.api.tokens.txs(this.crypto.address, this.addressString, this.txsCursor)
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
    const hdkey = HDKey.fromMasterSeed(Buffer.from(seed, this.settings.bip44 === 'm' ? 'utf8' : 'hex'));
    const base = hdkey.derive(this.settings.bip44);
    this.etherWallet = EthereumWallet.fromPrivateKey(base._privateKey);
    this.isLocked = false;
  }
  publicKey() {
    const data = {
      pubKey: this.etherWallet.pubKey.toString('hex'),
      path: this.settings.bip44,
    };
    return JSON.stringify(data);
  }
  getNextAddress() {
    return this.checkSumAddressString;
  }
  createTx(to, value) {
    validator.transaction({
      wallet: this,
      to,
      value,
    });

    const params = {
      nonce: new BN(this.txsCount),
      ...this.#gasParams(),
    };

    if (this.crypto.type === 'token') {
      params.to = this.crypto.address;
      params.value = new BN(0);
      params.data = '0x' + transferTokenHash;
      params.data += helpers.padLeft(to.substr(2), 32);
      params.data += helpers.padLeft(new BN(value).toString(16), 32);
    } else {
      params.to = to;
      params.value = new BN(value);
    }
    const that = this;
    const tx = this.#buildTransaction(params);
    return {
      sign() {
        return tx.sign(that.etherWallet.getPrivateKey());
      },
    };
  }
  createReplacement(tx) {
    const that = this;
    let maxPriorityFeePerGas, maxFeePerGas, gasPrice, amount;
    if (this.network.eip1559) {
      maxPriorityFeePerGas = helpers.scale(tx.maxPriorityFeePerGas, this.replaceByFeeFactor);
      maxFeePerGas = helpers.scale(tx.maxFeePerGas, this.replaceByFeeFactor);
      amount = Big(tx.gasLimit).times(Big(maxFeePerGas).minus(tx.maxFeePerGas)).toFixed(0);
    } else {
      gasPrice = helpers.scale(tx.gasPrice, this.replaceByFeeFactor);
      amount = Big(tx.gasLimit).times(Big(gasPrice).minus(tx.gasPrice)).toFixed(0);
    }
    validator.replacement({
      wallet: this,
      amount,
    });
    const params = {
      nonce: new BN(tx.nonce),
      gasLimit: new BN(tx.gasLimit),
      to: tx.to,
      value: new BN(tx.value),
      data: tx.input,
      ...this.network.eip1559 ? {
        maxPriorityFeePerGas: new BN(maxPriorityFeePerGas),
        maxFeePerGas: new BN(maxFeePerGas),
      } : {
        gasPrice: new BN(gasPrice),
      },
    };
    const replacementTx = this.#buildTransaction(params, { freeze: false });
    return {
      amount,
      sign() {
        const signed = replacementTx.sign(that.etherWallet.getPrivateKey());
        signed.replaceByFeeTx = tx;
        return signed;
      },
    };
  }
  get defaultFee() {
    return Big(this.gasLimit).times(this.network.eip1559 ? this.gasFees.maxFeePerGas : this.gasPrice);
  }
  get maxAmount() {
    const fee = this.crypto.type === 'token' ? 0 : this.defaultFee;
    const balance = Big(this.balance).minus(fee);
    return helpers.max(balance, 0);
  }
  async sendTx(tx) {
    const rawtx = '0x' + tx.serialize().toString('hex');
    await this.api.transactions.propagate(rawtx);
    if (this.crypto.type === 'token') {
      return this.processTokenTx(tx);
    } else {
      return this.processTx(tx);
    }
  }
  async processTx(tx) {
    let historyTx = await this.api.transactions.get(`0x${tx.hash().toString('hex')}`, this.addressString);
    const { replaceByFeeTx } = tx;
    if (replaceByFeeTx) {
      const fee = this.#txFee(replaceByFeeTx);
      this.balance = Big(this.balance).minus(replaceByFeeTx.amount).plus(fee).toFixed(0);
    }
    historyTx = transformTxs(this, historyTx);
    const fee = historyTx.from === this.addressString ? this.#txFee(historyTx) : 0;
    this.balance = Big(this.balance).plus(historyTx.amount).minus(fee).toFixed(0);
    if (historyTx.from === this.addressString && !replaceByFeeTx) {
      this.txsCount++;
    }
    this.cache.set('balance', this.balance);
    return historyTx;
  }
  async processTokenTx(tx) {
    const from = tx.getSenderAddress().toString('hex');
    const to = `0x${tx.data.slice(16, 36).toString('hex')}`;
    let value = Big((new BN(tx.data.slice(36))).toString(10));
    if (from === to) {
      value = Big(0);
    } else if (from === this.addressString) {
      value = value.neg();
    }
    this.balance = Big(this.balance).plus(value).toFixed(0);
    if (from === this.addressString) {
      this.ethBalance = Big(this.ethBalance).minus(this.#txFee(tx)).toFixed(0);
      this.txsCount++;
    }
    this.cache.set('balance', this.balance);
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
    const fee = this.crypto.type === 'token' ? 0 : this.defaultFee;
    const amount = Big(options.amount).minus(fee);
    if (amount.lt(0)) {
      throw new Error('Insufficient funds');
    }
    if (this.crypto.type === 'token') {
      const ethFee = this.defaultFee;
      if (Big(options.ethBalance).lt(ethFee)) {
        const error = new Error('Insufficient funds for token transaction');
        error.required = ethFee;
        throw error;
      }
    }
    const params = {
      nonce: new BN(options.txsCount),
      ...this.#gasParams(),
    };
    if (this.crypto.type === 'token') {
      params.to = this.crypto.address;
      params.value = new BN(0);
      params.data = '0x' + transferTokenHash;
      params.data += helpers.padLeft(options.to.substr(2), 32);
      params.data += helpers.padLeft(new BN(amount.toFixed(0)).toString(16), 32);
    } else {
      params.to = options.to;
      params.value = new BN(amount.toFixed(0));
    }
    const tx = this.#buildTransaction(params);
    return {
      sign() {
        return tx.sign(options.privateKey);
      },
    };
  }
  async getImportTxOptions(privateKey) {
    const publicKey = ethUtil.privateToPublic(privateKey);
    const address = ethUtil.bufferToHex(ethUtil.pubToAddress(publicKey));

    let promises;
    if (this.crypto.type === 'token') {
      promises = [
        this.api.tokens.balance(this.crypto.address, address, this.minConf),
        this.api.addresses.txsCount(address),
        this.update(),
        this.api.addresses.balance(address, this.minConf),
      ];
    } else {
      promises = [
        this.api.addresses.balance(address, this.minConf),
        this.api.addresses.txsCount(address),
        this.update,
      ];
    }

    const results = await Promise.all(promises);

    const importTxOptions = {
      privateKey,
      amount: helpers.min(results[0].confirmedBalance, results[0].balance),
      txsCount: results[1],
    };
    if (this.crypto.type === 'token') {
      importTxOptions.ethBalance = helpers.min(results[3].confirmedBalance, results[3].balance);
    }
    return importTxOptions;
  }
  exportPrivateKeys() {
    let str = 'address,privatekey\n';
    str += this.addressString + ',' + this.etherWallet.getPrivateKeyString().substr(2);
    return str;
  }
  txUrl(txId) {
    return this.#txUrl.replace('${txId}', txId);
  }
  #gasParams() {
    return {
      gasLimit: new BN(this.gasLimit),
      ...this.network.eip1559 ? {
        maxPriorityFeePerGas: new BN(this.gasFees.maxPriorityFeePerGas),
        maxFeePerGas: new BN(this.gasFees.maxFeePerGas),
      } : {
        gasPrice: new BN(this.gasPrice),
      },
    };
  }
  #txFee({ gasLimit, gasPrice, maxFeePerGas }) {
    return Big(gasLimit).times(maxFeePerGas || gasPrice);
  }
  #buildTransaction(params, options = {}) {
    if (this.network.eip1559) {
      return FeeMarketEIP1559Transaction.fromTxData(params, { common: this.common, ...options });
    } else {
      return Transaction.fromTxData(params, { common: this.common, ...options });
    }
  }
  serialize() {
    return JSON.stringify({
      crypto: this.crypto,
      balance: this.balance,
      confirmedBalance: this.confirmedBalance,
      txsCount: this.txsCount,
      privateKey: this.etherWallet.getPrivateKeyString(),
      addressString: this.etherWallet.getAddressString(),
      gasLimit: this.gasLimit,
      minConf: this.minConf,
      chainId: this.chainId,
      networkId: this.networkId,
    });
  }
  static deserialize(json) {
    const wallet = new Wallet();
    const deserialized = JSON.parse(json);
    const privateKey = wallet.createPrivateKey(deserialized.privateKey);

    wallet.crypto = deserialized.crypto;
    wallet.cache = { get: () => {}, set: () => {} };
    wallet.api = new API({});
    wallet.balance = deserialized.balance;
    wallet.confirmedBalance = deserialized.confirmedBalance;
    wallet.txsCount = deserialized.txsCount;
    wallet.etherWallet = EthereumWallet.fromPrivateKey(privateKey);
    wallet.addressString = deserialized.addressString;
    wallet.maxReplaceByFeeGas = deserialized.maxReplaceByFeeGas;
    wallet.gasLimit = deserialized.gasLimit;
    wallet.minConf = deserialized.minConf;
    wallet.chainId = deserialized.chainId;
    wallet.networkId = deserialized.networkId;
    wallet.common = EthereumCommon.custom(
      { chainId: wallet.chainId, networkId: wallet.networkId },
      { eips: [1559], hardfork: Hardfork.London }
    );
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
    const { gasPrice, maxFeePerGas, maxPriorityFeePerGas } = tx;
    return {
      id: tx.token ? tx.txId : tx._id,
      amount,
      value: tx.value,
      timestamp: tx.timestamp * 1000,
      confirmed: tx.confirmations >= wallet.minConf,
      minConf: wallet.minConf,
      confirmations: tx.confirmations,
      gasLimit: tx.gas,
      status: tx.status === null ? true : tx.status,
      from: tx.from,
      to: tx.to,
      token: tx.token,
      isIncoming,
      nonce: tx.nonce,
      input: tx.input,
      ...tx.confirmations ? {
        gasPrice,
        fee: tx.token ? 0 : Big(tx.gasUsed).times(tx.gasPrice).toFixed(0),
        isRBF: false,
      } : {
        fee: -1,
        isRBF: Big(gasPrice || maxFeePerGas).times(wallet.replaceByFeeFactor).lt(wallet.maxReplaceByFeeGas),
        ...gasPrice ? {
          gasPrice,
        } : {
          maxFeePerGas,
          maxPriorityFeePerGas,
        },
      },
    };
  }
}

export default Wallet;
