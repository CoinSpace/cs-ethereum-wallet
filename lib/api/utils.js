'use strict';
require('es6-promise').polyfill();

var axios = require('axios');

function getRequest(url, params) {
  return axios.get(url, {params: params})
    .then(function(res) {
      return res.data;
    }).catch(function(err) {
      return Promise.reject({
        url: url,
        res: err,
        message: err ? err.statusText : ''
      });
    });
}

function postRequest(url, item) {
  return axios.post(url, item)
    .then(function(res) {
      return res.data;
    }).catch(function(err) {
      return Promise.reject({
        item: item,
        url: url,
        res: err,
        message: err ? err.statusText : ''
      });
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
