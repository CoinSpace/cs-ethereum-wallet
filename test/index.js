'use strict';

var assert = require('assert');
var Wallet = require('../');
var fixtures = require('./wallet');

describe('Ethereum Wallet', function() {
  var readOnlyWallet;

  before(function() {
    readOnlyWallet = Wallet.deserialize(JSON.stringify(fixtures));
  });

  it('should have more tests', function() {
    assert.equal('hi', 'hi');
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

});
