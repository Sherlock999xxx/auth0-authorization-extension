const path = require('path');
const FileStorageContext = require('./contexts/FileStorageContext');
const WebtaskStorageContext = require('./contexts/WebtaskStorageContext');
const BlobRecordProvider = require('./contexts/BlobRecordProvider');
const { S3StorageContext } = require('../tools/s3-storage-context');

const config = require('../config');
const logger = require('../logger');

function createProvider(storageContext) {
  switch (config('STORAGE_TYPE')) {
    case 's3': {
      logger.info('Initializing the S3 Storage Context.');

      const context = new S3StorageContext({
        path: config('S3_PATH'),
        bucket: config('S3_BUCKET'),
        keyId: config('S3_KEY'),
        keySecret: config('S3_SECRET'),
        defaultData: {}
      });
      return new BlobRecordProvider(context, { concurrentWrites: false });
    }
    case 'webtask':
    default: {
      logger.info('Initializing the Webtask Storage Context.');
      console.log('[providers] storageContext provided:', !!storageContext);
      console.log('[providers] storageContext type:', typeof storageContext);

      if (storageContext) {
        console.log('[providers] storageContext.get type:', typeof storageContext.get);
        console.log('[providers] storageContext.set type:', typeof storageContext.set);
        console.log('[providers] storageContext keys:', Object.keys(storageContext));
      }

      const context = storageContext
          ? new WebtaskStorageContext(storageContext, { force: 0 })
          : new FileStorageContext(path.join(__dirname, '../../data.json'), { mergeWrites: true });

      console.log('[providers] Created context type:', context.constructor.name);
      return new BlobRecordProvider(context, { concurrentWrites: false });
    }
  }
}

module.exports = { createProvider };
