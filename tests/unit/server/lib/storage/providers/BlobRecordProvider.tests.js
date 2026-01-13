import { expect } from 'chai';
import BlobRecordProvider from '../../../../../../server/lib/storage/contexts/BlobRecordProvider';
import WebtaskStorageContext from '../../../../../../server/lib/storage/contexts/WebtaskStorageContext';
import { NotFoundError, ValidationError } from '../../../../../../server/lib/errors';

// Mock webtaskStorage helper
function webtaskStorage(data, onDataChanged, beforeDataChanged) {
  let webtaskData = data;
  return {
    get: (cb) => {
      if (data && data.name === 'Error') {
        return cb(data);
      }
      return cb(null, JSON.parse(JSON.stringify(webtaskData))); // deep clone
    },
    set: (newData, opt, cb) => {
      if (data && data.name === 'Error') {
        return cb(data);
      }

      try {
        JSON.stringify(newData, null, 2);
      } catch (e) {
        return cb(e);
      }

      if (beforeDataChanged) {
        const error = beforeDataChanged();
        if (error) {
          return cb(error);
        }
      }

      webtaskData = newData;
      if (onDataChanged) {
        onDataChanged(webtaskData);
      }

      return setTimeout(cb, 5);
    }
  };
}

// Mock webtaskStorageContext helper
function webtaskStorageContext(onDataChanged, beforeDataChanged) {
  const data = {
    applications: [
      { _id: 'a1', name: 'a1' }
    ],
    users: [
      { _id: 1, name: 'John' },
      { _id: 23, name: 'Jane' }
    ]
  };

  const storage = webtaskStorage(data, onDataChanged, beforeDataChanged);
  return new WebtaskStorageContext(storage);
}

describe('BlobRecordProvider', () => {
  it('should throw error if storageContext is not provided', () => {
    try {
      new BlobRecordProvider();
      expect.fail('Should have thrown');
    } catch (e) {
      expect(e).to.be.ok;
    }
  });

  it('should return all records for a collection', async () => {
    const context = webtaskStorageContext();
    const provider = new BlobRecordProvider(context);
    const users = await provider.getAll('users');
    expect(users).to.be.ok;
    expect(users.length).to.equal(2);
    expect(users[1].name).to.equal('Jane');
  });

  it('should return empty array if collection does not exist', async () => {
    const context = webtaskStorageContext();
    const provider = new BlobRecordProvider(context);
    const data = await provider.getAll('someRandomCollection');
    expect(data).to.be.ok;
    expect(data.length).to.equal(0);
  });

  it('should return a record by its id', async () => {
    const context = webtaskStorageContext();
    const provider = new BlobRecordProvider(context);
    const user = await provider.get('users', 23);
    expect(user).to.be.ok;
    expect(user.name).to.equal('Jane');
  });

  it('should return a NotFound error if record does not exist', async () => {
    const context = webtaskStorageContext();
    const provider = new BlobRecordProvider(context);
    try {
      await provider.get('users', 545);
      expect.fail('Should have thrown');
    } catch (err) {
      expect(err).to.be.ok;
      expect(err).to.be.instanceOf(NotFoundError);
    }
  });

  it('should add a new record to the collection', async () => {
    let data = null;
    const context = webtaskStorageContext((updatedData) => {
      data = updatedData;
    });

    const provider = new BlobRecordProvider(context);
    const user = await provider.create('users', { _id: 5, name: 'User 5' });
    expect(user).to.be.ok;
    expect(user._id).to.equal(5);
    expect(user.name).to.equal('User 5');
    expect(data.users[2]).to.equal(user);
    expect(data.users[2]._id).to.equal(5);
    expect(data.users[2].name).to.equal('User 5');
  });

  it('should support queueing of write requests', async () => {
    let data = null;
    const context = webtaskStorageContext((updatedData) => {
      data = updatedData;
    });

    const provider = new BlobRecordProvider(context, { concurrentWrites: false });

    const userCount = Array.from(Array(1000).keys());
    await Promise.all(userCount.map((currentUser) => {
      return provider.create('bulkusers', { _id: currentUser, name: 'User ' + currentUser });
    }));
    expect(data.bulkusers.length).to.equal(1000);
  });

  it('should not work correctly when concurrent writes are enabled for bulk operations', async () => {
    let data = null;
    const context = webtaskStorageContext((updatedData) => {
      data = updatedData;
    });

    const provider = new BlobRecordProvider(context, { concurrentWrites: true });

    const userCount = Array.from(Array(1000).keys());
    await Promise.all(userCount.map((currentUser) => {
      return provider.create('bulkusers', { _id: currentUser, name: 'User ' + currentUser });
    }));
    expect(data.bulkusers.length).to.be.lessThan(1000);
  });

  it('should not interact with other collections', async () => {
    let data = null;
    const context = webtaskStorageContext((updatedData) => {
      data = updatedData;
    });

    const provider = new BlobRecordProvider(context);
    const user = await provider.create('users', { _id: 5, name: 'User 5' });
    expect(user).to.be.ok;
    expect(data.applications[0]._id).to.equal('a1');
  });

  it('should generate its own id if not provided', async () => {
    let data = null;
    const context = webtaskStorageContext((updatedData) => {
      data = updatedData;
    });

    const provider = new BlobRecordProvider(context);
    const user = await provider.create('users', { name: 'User 5' });
    expect(user).to.be.ok;
    expect(user._id).to.be.ok;
    expect(user._id.length).to.equal(36);
    expect(user.name).to.equal('User 5');
    expect(data.users[2]).to.equal(user);
    expect(data.users[2]._id).to.equal(user._id);
    expect(data.users[2].name).to.equal('User 5');
  });

  it('should not allow duplicate identifiers', async () => {
    const context = webtaskStorageContext();
    const provider = new BlobRecordProvider(context);
    try {
      await provider.create('users', { _id: 23, name: 'User 5' });
      expect.fail('Should have thrown');
    } catch (err) {
      expect(err).to.be.ok;
      expect(err).to.be.instanceOf(ValidationError);
    }
  });

  it('should surface storage errors on create', async () => {
    let data = null;
    const context = webtaskStorageContext(
      (updatedData) => {
        data = updatedData;
      },
      () => {
        return new Error('write_error');
      }
    );

    const provider = new BlobRecordProvider(context);
    try {
      await provider.create('users', { _id: 50, name: 'User 5' });
      expect.fail('Should have thrown');
    } catch (err) {
      expect(err).to.be.ok;
      expect(err.message).to.equal('write_error');
    }
  });

  it('should perform write retries if storage context supports it on create', async () => {
    let data = null;
    let attempts = 0;
    const context = webtaskStorageContext(
      (updatedData) => {
        data = updatedData;
      },
      () => {
        attempts++;

        if (attempts < 3) {
          const error = new Error('Write conflict!');
          error.code = 409;
          return error;
        }
      }
    );

    const provider = new BlobRecordProvider(context);
    const user = await provider.create('users', { _id: 5, name: 'User 5' });
    expect(user).to.be.ok;
    expect(attempts).to.equal(3);
  });

  it('should update records correctly', async () => {
    let data = null;
    const context = webtaskStorageContext((updatedData) => {
      data = updatedData;
    });

    const provider = new BlobRecordProvider(context);
    const user = await provider.update('users', 23, { name: 'User 6', foo: 'bar' });
    expect(user).to.be.ok;
    expect(user._id).to.be.ok;
    expect(user.foo).to.equal('bar');
    expect(user.name).to.equal('User 6');
    expect(data.users.length).to.equal(2);
    expect(data.users[1]).to.equal(user);
    expect(data.users[1]._id).to.equal(user._id);
    expect(data.users[1].name).to.equal('User 6');
  });

  it('should support queueing of write requests on update', async () => {
    let data = null;
    const context = webtaskStorageContext((updatedData) => {
      data = updatedData;
    });

    const provider = new BlobRecordProvider(context, { concurrentWrites: false });

    const userCount = Array.from(Array(100).keys());
    await Promise.all(userCount.map((currentUser) => {
      return provider.update('bulkusers', currentUser, { _id: currentUser, name: 'User ' + currentUser }, true);
    }));
    expect(data.bulkusers.length).to.equal(100);
  });

  it('should upsert records correctly', async () => {
    let data = null;
    const context = webtaskStorageContext((updatedData) => {
      data = updatedData;
    });

    const provider = new BlobRecordProvider(context);
    const user = await provider.update('users', 24, { name: 'User 6', foo: 'bar' }, true);
    expect(user).to.be.ok;
    expect(user._id).to.be.ok;
    expect(user.foo).to.equal('bar');
    expect(user.name).to.equal('User 6');
    expect(data.users.length).to.equal(3);
    expect(data.users[2]).to.equal(user);
    expect(data.users[2]._id).to.equal(user._id);
    expect(data.users[2].name).to.equal('User 6');
  });

  it('should surface storage errors on update', async () => {
    let data = null;
    const context = webtaskStorageContext(
      (updatedData) => {
        data = updatedData;
      },
      () => {
        return new Error('write_error');
      }
    );

    const provider = new BlobRecordProvider(context);
    try {
      await provider.update('users', 24, { name: 'User 6', foo: 'bar' }, true);
      expect.fail('Should have thrown');
    } catch (err) {
      expect(err).to.be.ok;
      expect(err.message).to.equal('write_error');
    }
  });

  it('should throw error if record does not exist on update', async () => {
    const context = webtaskStorageContext();
    const provider = new BlobRecordProvider(context);
    try {
      await provider.update('users', 24, { name: 'User 6', foo: 'bar' }, false);
      expect.fail('Should have thrown');
    } catch (err) {
      expect(err).to.be.ok;
      expect(err).to.be.instanceOf(NotFoundError);
    }
  });

  it('should perform write retries if storage context supports it on update', async () => {
    let data = null;
    let attempts = 0;
    const context = webtaskStorageContext(
      (updatedData) => {
        data = updatedData;
      },
      () => {
        attempts++;

        if (attempts < 3) {
          const error = new Error('Write conflict!');
          error.code = 409;
          return error;
        }
      }
    );

    const provider = new BlobRecordProvider(context);
    const user = await provider.update('users', 23, { name: 'User 6', foo: 'bar' });
    expect(user).to.be.ok;
    expect(attempts).to.equal(3);
  });

  it('should return true if the record exists on delete', async () => {
    let data = null;
    const context = webtaskStorageContext((updatedData) => {
      data = updatedData;
    });

    const provider = new BlobRecordProvider(context);
    const deleted = await provider.delete('users', 23);
    expect(deleted).to.be.ok;
    expect(data.users.length).to.equal(1);
    expect(data.users[0]._id).to.equal(1);
    expect(data.users[0].name).to.equal('John');
  });

  it('should return false if record does not exist on delete', async () => {
    const context = webtaskStorageContext();
    const provider = new BlobRecordProvider(context);
    const deleted = await provider.delete('users', 24);
    expect(deleted).to.not.be.ok;
  });

  it('should perform write retries if storage context supports it on delete', async () => {
    let data = null;
    let attempts = 0;
    const context = webtaskStorageContext(
      (updatedData) => {
        data = updatedData;
      },
      () => {
        attempts++;

        if (attempts < 3) {
          const error = new Error('Write conflict!');
          error.code = 409;
          return error;
        }
      }
    );

    const provider = new BlobRecordProvider(context);
    const deleted = await provider.delete('users', 23);
    expect(deleted).to.be.ok;
    expect(data.users.length).to.equal(1);
    expect(data.users[0]._id).to.equal(1);
    expect(data.users[0].name).to.equal('John');
  });

  it('should surface storage errors on delete', async () => {
    let data = null;
    const context = webtaskStorageContext(
      (updatedData) => {
        data = updatedData;
      },
      () => {
        return new Error('write_error');
      }
    );

    const provider = new BlobRecordProvider(context);
    try {
      await provider.delete('users', 23);
      expect.fail('Should have thrown');
    } catch (err) {
      expect(err).to.be.ok;
      expect(err.message).to.equal('write_error');
    }
  });

  it('should support queueing of write requests on delete', async () => {
    let data = null;
    const context = webtaskStorageContext((updatedData) => {
      data = updatedData;
    });

    const provider = new BlobRecordProvider(context, { concurrentWrites: false });

    const userCount = Array.from(Array(100).keys());
    await Promise.all(userCount.map((currentUser) => {
      return provider.create('bulkusers', { _id: currentUser + 1, name: 'User ' + currentUser });
    }));
    expect(data.bulkusers.length).to.equal(100);

    await Promise.all(userCount.map((currentUser) => {
      return provider.update('bulkusers', currentUser + 1, { name: 'User Updated ' + currentUser });
    }));
    expect(data.bulkusers.length).to.equal(100);

    await Promise.all(userCount.map((currentUser) => {
      return provider.delete('bulkusers', currentUser + 1);
    }));
    expect(data.bulkusers.length).to.equal(0);
  });
});
