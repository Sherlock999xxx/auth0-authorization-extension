const ArgumentError = require('../../errors').ArgumentError;
const logger = require('../../logger');

/**
 * Create a new WebtaskStorageContext.
 * @param {Object} storage The Webtask storage object.
 * @param {Object} options The options object.
 * @param {int} options.force Disregard the possibility of a conflict.
 * @param {Object} options.defaultData The default data to use when the file does not exist or is empty.
 * @constructor
 */
function WebtaskStorageContext(storage, options) {
  if (storage === null || storage === undefined) {
    throw new ArgumentError('Must provide the Webtask storage object');
  }

  options = options || { force: 1 };

  this.storage = storage;
  this.options = options;
  this.defaultData = options.defaultData || {};
}

/**
 * Read payload from Webtask storage.
 * @return {Promise<object>} The object parsed from Webtask storage.
 */
WebtaskStorageContext.prototype.read = function() {
  const ctx = this;
  logger.info('[WebtaskStorageContext] read() called');
  logger.info('[WebtaskStorageContext] storage object type:', typeof ctx.storage);
  logger.info('[WebtaskStorageContext] storage.get type:', typeof ctx.storage.get);
  logger.info('[WebtaskStorageContext] options:', JSON.stringify(ctx.options));

  return new Promise(function readWebtaskStorageContext(resolve, reject) {
    logger.info('[WebtaskStorageContext] Calling storage.get()...');

    ctx.storage.get(function(err, data) {
      logger.info('[WebtaskStorageContext] storage.get() callback invoked');
      logger.info('[WebtaskStorageContext] err:', err);
      logger.info('[WebtaskStorageContext] data:', data ? 'present' : 'null/undefined');

      if (err) {
        logger.info('[WebtaskStorageContext] Rejecting with error:', err.message || err);
        return reject(err);
      }

      logger.info('[WebtaskStorageContext] Resolving with data');
      return resolve(data || ctx.defaultData);
    });

    logger.info('[WebtaskStorageContext] storage.get() called, waiting for callback...');
  });
};

/**
 * Write data to Webtask storage.
 * @param {object} data The object to write.
 * @return {Promise<void>}
 */
WebtaskStorageContext.prototype.write = function(data) {
  const ctx = this;
  logger.info('[WebtaskStorageContext] write() called');
  logger.info('[WebtaskStorageContext] data keys:', data ? Object.keys(data) : 'null/undefined');
  logger.info('[WebtaskStorageContext] options:', JSON.stringify(ctx.options));

  return new Promise(function(resolve, reject) {
    logger.info('[WebtaskStorageContext] Calling storage.set()...');

    ctx.storage.set(data, ctx.options, function(err) {
      logger.info('[WebtaskStorageContext] storage.set() callback invoked');
      logger.info('[WebtaskStorageContext] err:', err);

      if (err) {
        logger.info('[WebtaskStorageContext] Rejecting with error:', err.message || err, 'code:', err.code);
        return reject(err);
      }

      logger.info('[WebtaskStorageContext] Resolving write');
      return resolve();
    });

    logger.info('[WebtaskStorageContext] storage.set() called, waiting for callback...');
  });
};

/**
 * Perform retries on write if a webtask storage conflict is detected.
 * @param {object} err The write error to examine.
 * @return {boolean}
 */
WebtaskStorageContext.prototype.writeRetryCondition = function(err) {
  return err.code === 409;
};

module.exports = WebtaskStorageContext;
