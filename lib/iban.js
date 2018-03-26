'use strict';
var BN = require('bn.js');
var helpers = require('./helpers');

var Iban = function (iban) {
  this._iban = iban;
};

Iban.isValid = function (iban) {
  var i = new Iban(iban);
  return i.isValid();
};

Iban.prototype.isValid = function() {
  return /^XE[0-9]{2}(ETH[0-9A-Z]{13}|[0-9A-Z]{30,31})$/.test(this._iban) &&
    mod9710(iso13616Prepare(this._iban)) === 1;
};

Iban.prototype.isDirect = function() {
  return this._iban.length === 34 || this._iban.length === 35;
};

Iban.prototype.address = function() {
  if (this.isDirect()) {
    var base36 = this._iban.substr(4);
    var asBn = new BN(base36, 36);
    return '0x' + helpers.padLeft(asBn.toString(16), 20);
  }
  return '';
};

// Helper functions

function iso13616Prepare(iban) {
  var A = 'A'.charCodeAt(0);
  var Z = 'Z'.charCodeAt(0);

  iban = iban.toUpperCase();
  iban = iban.substr(4) + iban.substr(0,4);

  return iban.split('').map(function(n){
    var code = n.charCodeAt(0);
    if (code >= A && code <= Z){
      // A = 10, B = 11, ... Z = 35
      return code - A + 10;
    } else {
      return n;
    }
  }).join('');
}

function mod9710(iban) {
  var remainder = iban,
    block;

  while (remainder.length > 2){
    block = remainder.slice(0, 9);
    remainder = parseInt(block, 10) % 97 + remainder.slice(block.length);
  }

  return parseInt(remainder, 10) % 97;
}

module.exports = Iban;
