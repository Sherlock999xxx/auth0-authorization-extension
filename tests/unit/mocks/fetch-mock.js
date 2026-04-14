// Mock fetch to work with nock
// This wraps the native fetch to work through nock's HTTP interceptors
const nock = require('nock');

// Store original fetch
const originalFetch = global.fetch;

// Create a custom fetch that works with nock
global.fetch = async function(url, options = {}) {
  // Convert fetch request to a format nock can intercept
  const urlObj = new URL(url);

  // Check if nock has an interceptor for this request
  const method = (options.method || 'GET').toUpperCase();
  const path = urlObj.pathname + urlObj.search;

  // Try to use nock's HTTP adapter instead
  const http = require('http');
  const https = require('https');

  return new Promise((resolve, reject) => {
    const protocol = urlObj.protocol === 'https:' ? https : http;
    const req = protocol.request({
      hostname: urlObj.hostname,
      port: urlObj.port,
      path: path,
      method: method,
      headers: options.headers || {}
    }, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        // Convert HTTP response to fetch Response
        resolve({
          ok: res.statusCode >= 200 && res.statusCode < 300,
          status: res.statusCode,
          statusCode: res.statusCode,
          statusText: res.statusMessage,
          headers: new Headers(res.headers),
          json: async () => {
            try {
              return data ? JSON.parse(data) : null;
            } catch (e) {
              console.error('Failed to parse JSON:', data);
              throw e;
            }
          },
          text: async () => data,
          body: data
        });
      });
    });

    req.on('error', reject);

    if (options.body) {
      req.write(typeof options.body === 'string' ? options.body : JSON.stringify(options.body));
    }

    req.end();
  });
};

module.exports = global.fetch;
