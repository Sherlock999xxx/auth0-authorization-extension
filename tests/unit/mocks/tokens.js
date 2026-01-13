import nock from 'nock';
import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import certs from './certs.json';
import config from '../../../server/lib/config';

const defaultCert = certs.test;

// Extract n and e from a PEM certificate
function extractRsaPublicKeyComponents(certPem) {
  const certObj = crypto.createPublicKey({
    key: certPem,
    format: 'pem'
  });
  const jwk = certObj.export({ format: 'jwk' });
  return {
    n: jwk.n,
    e: jwk.e
  };
}

module.exports.wellKnownEndpoint = (domain, kidOrCert, kid) => {
   // Support both old signature (domain, kid) and new signature (domain, cert, kid)
   let cert;
   let keyId;
   let certPem;

   if (kid === undefined) {
     // Old signature: (domain, kid)
     cert = defaultCert;
     keyId = kidOrCert;
     certPem = cert.cert;
   } else {
     // New signature: (domain, cert, kid)
     // cert can be a string (cert name like 'bar') or an object (cert data)
     if (typeof kidOrCert === 'string') {
       cert = certs[kidOrCert];
       certPem = cert.cert;
     } else {
       // kidOrCert is the actual cert PEM string
       certPem = kidOrCert;
       cert = null;
     }
     keyId = kid;
   }

   // Extract RSA components from certificate
   const rsaComponents = extractRsaPublicKeyComponents(certPem);

   return nock(`https://${domain}`)
    .get('/.well-known/jwks.json')
    .reply(200, {
      keys: [
        {
          alg: 'RS256',
          use: 'sig',
          kty: 'RSA',
          x5c: [ certPem.match(/-----BEGIN CERTIFICATE-----([\s\S]*)-----END CERTIFICATE-----/i)[1].replace(/[\r\n]/g, '') ],
          kid: keyId,
          n: rsaComponents.n,
          e: rsaComponents.e
        }
      ]
    });
};

module.exports.sign = (certArg, kid, payload) =>
   jwt.sign(payload, certArg, { header: { kid }, algorithm: 'RS256' })
;

module.exports.getToken = (scope) =>
   module.exports.sign(defaultCert.privateKey, 'key2', {
     iss: `https://${config('AUTH0_DOMAIN')}/`,
     aud: 'urn:auth0-authz-api',
     sub: '123456@clients',
     scope
   })
;

module.exports.getUserToken = (scope) =>
   module.exports.sign(defaultCert.privateKey, 'key2', {
     iss: `https://${config('AUTH0_DOMAIN')}/`,
     aud: 'urn:auth0-authz-api',
     sub: 'auth0|aaaaaaaaa',
     azp: '123',
     scope
   })
;

module.exports.getAdminTokenWithoutAccessToken = (scope) =>
  jwt.sign({
    iss: 'http://foo',
    aud: 'urn:api-authz',
    sub: 'auth0|aaaaaaaaa',
    azp: '123',
    scope
  }, 'abc')
;

module.exports.getApiToken = (gty, sub, scope) =>
  module.exports.sign(defaultCert.privateKey, 'key2', {
    iss: `https://${config('AUTH0_DOMAIN')}/`,
    aud: 'urn:auth0-authz-api',
    sub: `auth0@${sub}`,
    azp: '123',
    gty,
    scope
  })
;
