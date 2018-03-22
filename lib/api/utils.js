'use strict';
require('es6-promise').polyfill();

var axios = require('axios');

function getRequest(url, params) {
  return axios.get(url, {params: params})
    .then(function(res) {
      return res.data;
    });
}

function postRequest(url, item) {
  return axios.post(url, item)
    .then(function(res) {
      return res.data;
    });
}

function promiseWhile(predicate, action) {
  function loop() {
    if (!predicate()) return;
    return Promise.resolve(action()).then(loop);
  }
  return Promise.resolve().then(loop);
}

module.exports = {
  getRequest: getRequest,
  postRequest: postRequest,
  promiseWhile: promiseWhile
};
