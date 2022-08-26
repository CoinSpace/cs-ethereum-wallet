import Big from 'big.js';

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

function scale(value, factor) {
  let newValue = Big(value).times(factor).toFixed(0);
  if (newValue === value) {
    newValue = Big(newValue).plus(1).toFixed(0);
  }
  return newValue;
}

export default {
  padLeft,
  min,
  max,
  scale,
};
