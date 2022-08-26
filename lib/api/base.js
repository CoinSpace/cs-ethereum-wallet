export default class Base {
  constructor({ apiNode, request }) {
    this.apiNode = apiNode;
    this.request = request;
  }

  requestNode(config) {
    return this.request({
      ...config,
      baseURL: this.apiNode,
      disableDefaultCatch: true,
      seed: 'public',
    }).catch((err) => {
      const message = err.response && err.response.data;
      if (/Gas limit is too low/.test(message)) throw new Error('Gas limit is too low');
      console.error(err);
      throw new Error('cs-node-error');
    });
  }
}
