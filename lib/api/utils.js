'use strict';

const axios = require('axios').create({ timeout: 30000 });
const axiosRetry = require('axios-retry');

axiosRetry(axios, { retries: 3, retryDelay: axiosRetry.exponentialDelay, shouldResetTimeout: true });

function getRequest(url, params) {
  return axios.get(url, { params })
    .then((res) => {
      return res.data;
    }).catch((err) => {
      console.error(err);
      throw new Error('cs-node-error');
    });
}

function postRequest(url, item) {
  return axios.post(url, item)
    .then((res) => {
      return res.data;
    }).catch((err) => {
      console.error(err);
      throw new Error('cs-node-error');
    });
}

module.exports = {
  getRequest,
  postRequest,
};
