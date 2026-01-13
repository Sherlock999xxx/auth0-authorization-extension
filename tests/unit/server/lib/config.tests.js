import { expect } from 'chai';
import configFactory from '../../../../server/lib/config';

describe('config', () => {
  let config;
  let originalProvider;

  beforeEach(() => {
    config = configFactory;
    // Save the original provider set by runner.js
    originalProvider = null;
    try {
      // Try to get a value to see if provider is set
      config('__test__');
    } catch (e) {
      // If it throws, no provider is set
      originalProvider = null;
    }
  });

  afterEach(() => {
    // Restore the original provider from runner.js
    // The runner sets: config.setProvider((key) => nconf.get(key));
    if (originalProvider === null) {
      // Re-import nconf and set the provider back
      const nconf = require('nconf');
      config.setProvider((key) => nconf.get(key));
    }
  });

  it('should wrap provider', () => {
    const provider = (key) => {
      const data = {
        a: 'value1',
        b: 'value2',
        user: 'usr',
        password: 'pwd',
        Setting: 789
      };
      return data[key];
    };

    config.setProvider(provider);

    expect(config).to.be.ok;
    expect(config('a')).to.equal('value1');
    expect(config('user')).to.equal('usr');
    expect(config('Setting')).to.equal(789);
  });

  it('should allow getting custom values via setValue', () => {
    const provider = (key) => {
      const data = {
        a: 'value1',
        b: 'value2',
        user: 'usr',
        password: 'pwd',
        Setting: 789
      };
      return data[key];
    };

    config.setProvider(provider);
    config.setValue('foo', 'bar');

    expect(config).to.be.ok;
    expect(config('foo')).to.equal('bar');
    expect(config('a')).to.equal('value1');
    expect(config('user')).to.equal('usr');
    expect(config('Setting')).to.equal(789);
  });

  it('should throw error if provider not set', () => {
    // Create a minimal test by trying to access config without a provider
    // First we need to clear the provider (set it to null)
    config.setProvider(null);

    try {
      config('a');
      expect.fail('Should have thrown');
    } catch (e) {
      expect(e).to.be.ok;
      expect(e.message).to.equal('A configuration provider has not been set');
    }
  });
});
