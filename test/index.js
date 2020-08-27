'use strict';

var assert = require('assert');
var Wallet = require('../');
var fixtures = require('./wallet');
// eslint-disable-next-line max-len
var RANDOM_SEED = '2b48a48a752f6c49772bf97205660411cd2163fe6ce2de19537e9c94d3648c85c0d7f405660c20253115aaf1799b1c41cdd62b4cfbb6845bc9475495fc64b874';

describe('Ethereum Wallet', function() {
  var readOnlyWallet;

  before(function() {
    readOnlyWallet = Wallet.deserialize(JSON.stringify(fixtures));
  });

  it('should have more tests', function() {
    assert.equal('hi', 'hi');
  });

  describe('constructor', function() {
    it('with seed', function() {
      var wallet = new Wallet({
        networkName: 'ethereum',
        seed: RANDOM_SEED
      });
      assert.ok(wallet);
      assert.equal(wallet.isLocked, false);
    });

    it('with publicKey', function() {
      var wallet = new Wallet({
        networkName: 'ethereum',
        publicKey: readOnlyWallet.etherWallet.pubKey.toString('hex')
      });
      assert.equal(wallet.addressString, readOnlyWallet.addressString);
      assert.equal(wallet.isLocked, true);
      assert.ok(wallet);
    });
  });

  describe('lock', function() {
    it('works', function() {
      var wallet = new Wallet({
        networkName: 'ethereum',
        seed: RANDOM_SEED
      });
      assert.equal(wallet.isLocked, false);
      wallet.lock();
      assert.equal(wallet.etherWallet._privKey, null);
      assert.equal(wallet.isLocked, true);
    });
  });

  describe('unlock', function() {
    it('works', function() {
      var wallet = new Wallet({
        networkName: 'ethereum',
        publicKey: readOnlyWallet.etherWallet.pubKey.toString('hex')
      });
      assert.equal(wallet.isLocked, true);
      wallet.unlock(readOnlyWallet.etherWallet.privKey.toString('hex'));
      assert.equal(wallet.etherWallet.privKey.toString('hex'), readOnlyWallet.etherWallet.privKey.toString('hex'));
      assert.equal(wallet.isLocked, false);
    });
  });

  describe('dumpKeys', function() {
    it('works', function() {
      var wallet = new Wallet({
        networkName: 'ethereum',
        seed: RANDOM_SEED
      });
      var keys = wallet.dumpKeys();
      assert.ok(keys);
      assert.ok(keys.private);
      assert.ok(keys.public);
    });

    it('dumped keys are valid', function() {
      var wallet = new Wallet({
        networkName: 'ethereum',
        seed: RANDOM_SEED
      });
      var keys = wallet.dumpKeys();
      var secondWalet = new Wallet({
        networkName: 'ethereum',
        publicKey: keys.public
      });
      secondWalet.unlock(keys.private);
      assert.equal(wallet.etherWallet.privKey.toString('hex'), secondWalet.etherWallet.privKey.toString('hex'));
      assert.equal(wallet.addressString, secondWalet.addressString);
    });
  });

  describe('serialization & deserialization', function() {
    it('works', function() {
      assert.deepEqual(fixtures, JSON.parse(readOnlyWallet.serialize()));
    });
  });

  describe('createPrivateKey', function() {
    it('works', function() {
      var privateKey = readOnlyWallet.createPrivateKey(
        '0xdd440046e5eb40de6cf06081c827dceb1aaf8794c030ac7e7b9bec505768750c'
      );
      assert(privateKey instanceof Buffer);
      assert.equal(privateKey.length, 32);
    });

    it('errors on invalid private key', function(){
      assert.throws(function() { readOnlyWallet.createPrivateKey('123'); });
    });
  });

  describe('exportPrivateKeys', function() {
    it('works', function() {
      var csv = readOnlyWallet.exportPrivateKeys();
      assert.equal(typeof csv, 'string');
      assert(csv.length > 0);
    });
  });

});
