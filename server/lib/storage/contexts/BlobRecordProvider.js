const uuid = require('node-uuid');

const seriesQueue = require('./seriesQueue');
const ArgumentError = require('../../errors').ArgumentError;
const NotFoundError = require('../../errors').NotFoundError;
const ValidationError = require('../../errors').ValidationError;
const logger = require('../../logger');

const getDataForCollection = function(storageContext, collectionName) {
  logger.info('[getDataForCollection] Reading data for collection:', collectionName);
  return storageContext.read()
    .then(function(data) {
      logger.info('[getDataForCollection] Data read successfully, keys:', Object.keys(data || {}));
      data[collectionName] = data[collectionName] || [];
      logger.info('[getDataForCollection] Collection', collectionName, 'has', data[collectionName].length, 'items');
      return data;
    })
    .catch(function(err) {
      logger.info('[getDataForCollection] Error reading data:', err.message || err);
      throw err;
    });
};

// Simple promise retry implementation
const promiseRetry = function(fn, options) {
  logger.info('[promiseRetry] Starting with options:', JSON.stringify(options));
  let attempt = 0;
  const maxRetries = options.retries || 10;
  const factor = options.factor || 2;
  const minTimeout = options.minTimeout || 100;
  const maxTimeout = options.maxTimeout || Infinity;

  const retry = function(err) {
    attempt++;
    logger.info('[promiseRetry] Retry attempt', attempt, 'of', maxRetries);
    logger.info('[promiseRetry] Retry error:', err.message || err);
    if (attempt > maxRetries) {
      logger.info('[promiseRetry] Max retries exceeded, rejecting');
      return Promise.reject(err);
    }

    // Calculate timeout with exponential backoff
    const timeout = Math.min(minTimeout * Math.pow(factor, attempt - 1), maxTimeout);
    logger.info('[promiseRetry] Waiting', timeout, 'ms before retry');

    return new Promise(function(resolve) {
      setTimeout(resolve, timeout);
    }).then(function() {
      logger.info('[promiseRetry] Retrying function after timeout');
      return fn(retry);
    });
  };

  logger.info('[promiseRetry] Executing function (attempt 0)');
  return fn(retry);
};

const withRetry = function(storageContext, action) {
  const retryOptions = {
    retries: 10,
    factor: 2,
    minTimeout: 100,
    maxTimeout: Infinity,
    randomize: false
  };

  return function() {
    logger.info('[withRetry] Starting action with retry wrapper');
    return promiseRetry(function(retry) {
      logger.info('[withRetry] Executing action');
      return action()
        .then(function(result) {
          logger.info('[withRetry] Action succeeded');
          return result;
        })
        .catch(function(err) {
          logger.info('[withRetry] Action failed:', err.message || err);
          const writeRetryCondition =
            storageContext.writeRetryCondition ||
            function() { return false; };
          const shouldRetry = writeRetryCondition(err);
          logger.info('[withRetry] Should retry:', shouldRetry);
          if (shouldRetry) {
            logger.info('[withRetry] Retrying due to write conflict');
            return retry(err);
          }

          logger.info('[withRetry] Not retrying, throwing error');
          throw err;
        });
    }, retryOptions);
  };
};

/**
 * Create a new BlobRecordProvider.
 * @param {Object} storageContext The storage context.
 * @param {Object} options Options object.
 * @constructor
 */
function BlobRecordProvider(storageContext, options) {
  if (storageContext === null || storageContext === undefined) {
    throw new ArgumentError('Must provide a storage context');
  }

  this.storageContext = storageContext;
  this.queue = seriesQueue();
  this.options = options || {
    concurrentWrites: true
  };
}

/**
 * Write to the underlying storage layer
 * @param {Object} storageContext Storage context
 * @param {Function} action Action to execute.
 * @return {Promise}
 */
BlobRecordProvider.prototype.write = function(storageContext, action) {
  const actionWithRetry = withRetry(storageContext, action);

  // Concurrent writes are allowed.
  if (this.options.concurrentWrites) {
    return actionWithRetry();
  }

  // Concurrent writes are not allowed, process them sequentially.
  const queue = this.queue;
  return new Promise(function(resolve, reject) {
    queue(actionWithRetry, function(err, res) {
      if (err) {
        return reject(err);
      }

      return resolve(res);
    });
  });
};

/**
 * Get all records for a collection.
 * @param {string} collectionName The name of the collection.
 * @return {Promise<Array>} The records.
 */
BlobRecordProvider.prototype.getAll = function(collectionName) {
  return getDataForCollection(this.storageContext, collectionName)
    .then(function(data) {
      return data[collectionName];
    });
};

/**
 * Get a single record from a collection.
 * @param {string} collectionName The name of the collection.
 * @param {string} identifier The identifier of the record.
 * @return {Promise<Object>} The record.
 */
BlobRecordProvider.prototype.get = function(collectionName, identifier) {
  return this.getAll(collectionName)
    .then(function(records) {
      const record = records.find(function(r) { return r._id === identifier; });
      if (!record) {
        return Promise.reject(
          new NotFoundError('The record ' + identifier + ' in ' + collectionName + ' does not exist.')
        );
      }

      return record;
    });
};

/**
 * Create a record in a collection.
 * @param {string} collectionName The name of the collection.
 * @param {Object} record The record.
 * @return {Promise<Object>} The record.
 */
BlobRecordProvider.prototype.create = function(collectionName, record) {
  const storageContext = this.storageContext;
  return this.write(storageContext, function() {
    return getDataForCollection(storageContext, collectionName)
      .then(function(data) {
        if (!record._id) {
          record._id = uuid.v4();
        }

        const index = data[collectionName].findIndex(function(r) { return r._id === record._id; });
        if (index > -1) {
          return Promise.reject(
            new ValidationError('The record ' + record._id + ' in ' + collectionName + ' already exists.')
          );
        }

        // Add to dataset.
        data[collectionName].push(record);

        // Save.
        return storageContext.write(data)
          .then(function() {
            return record;
          });
      });
  });
};

/**
 * Update a record in a collection.
 * @param {string} collectionName The name of the collection.
 * @param {string} identifier The identifier of the record to update.
 * @param {Object} record The record.
 * @param {boolean} upsert Flag allowing to upsert if the record does not exist.
 * @return {Promise<Object>} The record.
 */
BlobRecordProvider.prototype.update = function(collectionName, identifier, record, upsert) {
  const storageContext = this.storageContext;
  return this.write(storageContext, function() {
    return getDataForCollection(storageContext, collectionName)
      .then(function(data) {
        const index = data[collectionName].findIndex(function(r) { return r._id === identifier; });
        if (index < 0 && !upsert) {
          throw new NotFoundError('The record ' + identifier + ' in ' + collectionName + ' does not exist.');
        }

        // Update record.
        const updatedRecord = Object.assign({ _id: identifier }, index < 0 ? {} : data[collectionName][index], record);
        if (index < 0) {
          data[collectionName].push(updatedRecord);
        } else {
          data[collectionName][index] = updatedRecord;
        }

        // Save.
        return storageContext.write(data)
          .then(function() {
            return updatedRecord;
          });
      });
  });
};

/**
 * Delete a record in a collection.
 * @param {string} collectionName The name of the collection.
 * @param {string} identifier The identifier of the record to update.
 * @return {Promise<boolean>}
 */
BlobRecordProvider.prototype.delete = function(collectionName, identifier) {
  const storageContext = this.storageContext;
  return this.write(storageContext, function() {
    return getDataForCollection(storageContext, collectionName)
      .then(function(data) {
        const index = data[collectionName].findIndex(function(r) { return r._id === identifier; });
        if (index < 0) {
          return false;
        }

        // Remove the record.
        data[collectionName].splice(index, 1);

        // Save.
        return storageContext.write(data)
          .then(function() {
            return true;
          });
      });
  });
};

module.exports = BlobRecordProvider;
