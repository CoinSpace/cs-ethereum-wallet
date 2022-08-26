import Iban from '../lib/iban.js';
import assert from 'assert';

describe('iban', () => {
  const ibanFixture = 'XE567GMDI1I6D0C818UK1PFR4T4URDRD2SX';
  const ibanSecondFixture = 'XE7338O073KYGTWWZN0F2WZ0R8PX5ZPPZS';
  const ibanIncorrectFixture = 'XE567GMDI2I6D0C818UK1PFR4T4URDRD2SX';

  it('should validate', () => {
    assert.equal(Iban.isValid(ibanFixture), true);
    assert.equal(Iban.isValid(ibanIncorrectFixture), false);
    assert.equal(Iban.isValid(''), false);
    assert.equal(Iban.isValid(111), false);
    assert.equal(Iban.isValid(false), false);
    assert.equal(Iban.isValid(true), false);
    assert.equal(Iban.isValid(null), false);
    assert.equal(Iban.isValid(undefined), false);
  });

  it('should create ETH address', () => {
    let address = new Iban(ibanFixture).address();
    assert.equal(address, '0x3fe0de839ae303070a9a537c5494195e40e1ce71');

    address = new Iban(ibanSecondFixture).address();
    assert.equal(address, '0x00c5496aee77c1ba1f0854206a26dda82a81d6d8');
  });
});
