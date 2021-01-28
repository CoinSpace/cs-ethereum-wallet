'use strict';
const Big = require('big.js');

function padLeft(string, bytes) {
  let result = string || '';
  while (result.length < bytes * 2) {
    result = '0' + result;
  }
  return result;
}

function min(a, b) {
  return Big(a).lt(b) ? a : b;
}
function max(a, b) {
  return Big(a).gt(b) ? a : b;
}

module.exports = {
  padLeft,
  min,
  max,
};
