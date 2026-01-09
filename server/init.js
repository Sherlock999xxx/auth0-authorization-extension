// eslint-disable-next-line import/no-extraneous-dependencies
import { URL } from 'node:url';

import config from './lib/config';
import Database from './lib/storage/database';
import { init as initDb } from './lib/storage/getdb';
import { createProvider } from './lib/storage/providers';

import createServer from './';
import logger from './lib/logger';

export default (cfg, storageContext, cb) => {
  if (cb == null) {
    cb = err => {
      if (err) {
        logger.error('Hapi initialization failed.');
        const { stack, details, message } = err;
        logger.error({ stack, details, message });
        logger.error(err);
      } else {
        logger.info('Hapi initialization completed.');
      }
    };
  }

  // Set configuration provider.
  config.setProvider(key => cfg(key) || process.env[key]);


  const publicUrl = config('PUBLIC_WT_URL');
  const host = new URL(publicUrl).hostname;
  const isLayer0TestSpace = host.split('.').slice(-2).join('.') === 'auth0c.com';
  // the purpose of this variable is to disable the caching in development environments
  config.setValue('IS_LAYER0_TEST_SPACE', isLayer0TestSpace);


  // Initialize the storage layer.
  logger.info('[init] Initializing storage layer');
  logger.info('[init] storageContext provided:', !!storageContext);
  logger.info('[init] storageContext type:', typeof storageContext);

  const provider = createProvider(storageContext);
  logger.info('[init] Provider created:', provider.constructor.name);

  const database = new Database({ provider });
  logger.info('[init] Database created');

  initDb(database);
  logger.info('[init] Database initialized in getdb');

  // Start the server.
  return createServer(cb);
};
