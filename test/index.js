'use strict';

const assert = require('assert');
const Wallet = require('../');
const fixtures = require('./wallet');
// eslint-disable-next-line max-len
const RANDOM_SEED = '2b48a48a752f6c49772bf97205660411cd2163fe6ce2de19537e9c94d3648c85c0d7f405660c20253115aaf1799b1c41cdd62b4cfbb6845bc9475495fc64b874';
// eslint-disable-next-line max-len
const RANDOM_SEED_PUB_KEY = '6337e0b448708659a757fbee3b0aa049dbc15a8f86ff6b5cabbc4b04895a43fadadf3ecc234414ce3083824b37976c63e70d0d75f0b5315712c429eadcc5cd6e';

describe('Ethereum Wallet', () => {
  let readOnlyWallet;

  before(() => {
    readOnlyWallet = Wallet.deserialize(JSON.stringify(fixtures));
  });

  it('should have more tests', () => {
    assert.equal('hi', 'hi');
  });

  describe('constructor', () => {
    it('with seed', () => {
      const wallet = new Wallet({
        networkName: 'ethereum',
        seed: RANDOM_SEED,
      });
      assert.ok(wallet);
      assert.equal(wallet.isLocked, false);
    });

    it('with publicKey', () => {
      const wallet = new Wallet({
        networkName: 'ethereum',
        publicKey: readOnlyWallet.etherWallet.pubKey.toString('hex'),
      });
      assert.equal(wallet.addressString, readOnlyWallet.addressString);
      assert.equal(wallet.isLocked, true);
      assert.ok(wallet);
    });
  });

  describe('lock', () => {
    it('works', () => {
      const wallet = new Wallet({
        networkName: 'ethereum',
        seed: RANDOM_SEED,
      });
      assert.equal(wallet.isLocked, false);
      wallet.lock();
      assert.equal(wallet.etherWallet._privKey, null);
      assert.equal(wallet.isLocked, true);
    });
  });

  describe('unlock', () => {
    it('works', () => {
      const wallet = new Wallet({
        networkName: 'ethereum',
        publicKey: RANDOM_SEED_PUB_KEY,
      });
      assert.equal(wallet.isLocked, true);
      wallet.unlock(RANDOM_SEED);
      assert.ok(wallet.etherWallet.privKey.toString('hex'));
      assert.equal(wallet.isLocked, false);
    });
  });

  describe('publicKey', () => {
    it('works', () => {
      const wallet = new Wallet({
        networkName: 'ethereum',
        seed: RANDOM_SEED,
      });
      const publicKey = wallet.publicKey();
      assert.ok(publicKey);
    });

    it('key is valid', () => {
      const wallet = new Wallet({
        networkName: 'ethereum',
        seed: RANDOM_SEED,
      });
      const publicKey = wallet.publicKey();
      const secondWalet = new Wallet({
        networkName: 'ethereum',
        publicKey,
      });
      secondWalet.unlock(RANDOM_SEED);
      assert.equal(wallet.etherWallet.privKey.toString('hex'), secondWalet.etherWallet.privKey.toString('hex'));
      assert.equal(wallet.addressString, secondWalet.addressString);
    });
  });

  describe('serialization & deserialization', () => {
    it('works', () => {
      assert.deepEqual(fixtures, JSON.parse(readOnlyWallet.serialize()));
    });
  });

  describe('createPrivateKey', () => {
    it('works', () => {
      const privateKey = readOnlyWallet.createPrivateKey(
        '0xdd440046e5eb40de6cf06081c827dceb1aaf8794c030ac7e7b9bec505768750c'
      );
      assert(privateKey instanceof Buffer);
      assert.equal(privateKey.length, 32);
    });

    it('errors on invalid private key', ()=> {
      assert.throws(() => { readOnlyWallet.createPrivateKey('123'); });
    });
  });

  describe('exportPrivateKeys', () => {
    it('works', () => {
      const csv = readOnlyWallet.exportPrivateKeys();
      assert.equal(typeof csv, 'string');
      assert(csv.length > 0);
    });
  });

});
