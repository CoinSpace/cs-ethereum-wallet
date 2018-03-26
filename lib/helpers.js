'use strict';
var Big = require('big.js');

function padLeft(string, bytes) {
  var result = string || '';
  while (result.length < bytes * 2) {
    result = '0' + result;
  }
  return result;
}

function min(a, b) {
  return Big(a).lt(b) ? a : b;
}

module.exports = {
  padLeft: padLeft,
  min: min
};
