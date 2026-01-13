import { expect } from 'chai';
import WebtaskStorageContext from '../../../../../../server/lib/storage/contexts/WebtaskStorageContext';

// Mock webtaskStorage helper
function webtaskStorage(data, onWrite) {
  return {
    get: (callback) => {
      if (data instanceof Error) {
        callback(data);
      } else {
        callback(null, data);
      }
    },
    set: (newData, options, callback) => {
      if (data instanceof Error) {
        callback(data);
      } else {
        try {
          // Simulate JSON serialization which would fail for circular references
          JSON.stringify(newData);
          if (onWrite) onWrite(newData);
          callback(null);
        } catch (err) {
          callback(err);
        }
      }
    }
  };
}

describe('WebtaskStorageContext', () => {
  it('should throw error if storage object is not provided', () => {
    try {
      new WebtaskStorageContext();
      expect.fail('Should have thrown');
    } catch (e) {
      expect(e).to.be.ok;
    }
  });

  it('should return defaultData if data from webtask is null', async () => {
    const storage = webtaskStorage(null);
    const ctx = new WebtaskStorageContext(storage, { defaultData: { foo: 'bar' } });
    const data = await ctx.read();
    expect(data).to.be.ok;
    expect(data.foo).to.be.ok;
    expect(data.foo).to.equal('bar');
  });

  it('should read storage correctly', async () => {
    const storage = webtaskStorage({ foo: 'other-bar' });
    const ctx = new WebtaskStorageContext(storage, { defaultData: { foo: 'bar' } });
    const data = await ctx.read();
    expect(data).to.be.ok;
    expect(data.foo).to.be.ok;
    expect(data.foo).to.equal('other-bar');
  });

  it('should handle errors correctly when reading fails', async () => {
    const storage = webtaskStorage(new Error('foo'));
    const ctx = new WebtaskStorageContext(storage);
    try {
      await ctx.read();
      expect.fail('Should have thrown');
    } catch (err) {
      expect(err).to.be.ok;
      expect(err.name).to.be.ok;
      expect(err.name).to.equal('Error');
    }
  });

  it('should write files correctly', async () => {
    let data = null;
    const storage = webtaskStorage({ application: 'my-app' }, (updatedData) => {
      data = updatedData;
    });
    const ctx = new WebtaskStorageContext(storage);
    await ctx.write({ application: 'my-new-app' });
    expect(data).to.be.ok;
    expect(data.application).to.be.ok;
    expect(data.application).to.equal('my-new-app');
  });

  it('should handle errors correctly when writing problematic objects', async () => {
    const storage = webtaskStorage({ });
    const a = { foo: 'bar' };
    const b = { bar: 'foo' };
    a.b = b;
    b.a = a;
    const ctx = new WebtaskStorageContext(storage);
    try {
      await ctx.write({ a: a, b: b });
      expect.fail('Should have thrown');
    } catch (err) {
      expect(err).to.be.ok;
      expect(err.name).to.be.ok;
      expect(err.name).to.equal('TypeError');
    }
  });

  it('should handle errors correctly when writing fails', async () => {
    const storage = webtaskStorage(new Error('foo'));
    const ctx = new WebtaskStorageContext(storage);
    try {
      await ctx.write({ foo: 'bar' });
      expect.fail('Should have thrown');
    } catch (err) {
      expect(err).to.be.ok;
      expect(err.name).to.be.ok;
      expect(err.name).to.equal('Error');
    }
  });
});
