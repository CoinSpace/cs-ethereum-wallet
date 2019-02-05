'use strict';

var axios = require('axios');

function getRequest(url, params) {
  return axios.get(url, {params: params})
    .then(function(res) {
      return res.data;
    }).catch(function(err) {
      console.error(err);
      throw new Error('cs-node-error');
    });
}

function postRequest(url, item) {
  return axios.post(url, item)
    .then(function(res) {
      return res.data;
    }).catch(function(err) {
      console.error(err);
      throw new Error('cs-node-error');
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
