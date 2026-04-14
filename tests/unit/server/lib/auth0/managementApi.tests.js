import { expect } from 'chai';
import nock from 'nock';
import jwt from 'jsonwebtoken';
import managementApi from '../../../../../server/lib/auth0/managementApi';
import { ArgumentError, ManagementApiError } from '../../../../../server/lib/errors';

describe('managementApi', () => {
  describe('#getAccessToken', () => {
    it('should handle network errors correctly', async () => {
      try {
        await managementApi.getAccessToken('foo.some.domain.tld', 'myclient', 'mysecret');
        expect.fail('Should have thrown');
      } catch (err) {
        expect(err).to.be.ok;
        expect(err.code).to.be.ok;
        // Network error codes can vary by environment (ENOTFOUND, ENETUNREACH, etc.)
        expect(err.code).to.be.a('string');
      }
    });

    it('should handle unauthorized errors correctly', async () => {
      nock('https://tenant.auth0cluster.com')
        .post('/oauth/token')
        .reply(401, 'Unauthorized');

      try {
        await managementApi.getAccessToken('tenant.auth0cluster.com', 'myclient', 'mysecret');
        expect.fail('Should have thrown');
      } catch (err) {
        expect(err).to.be.ok;
        expect(err.status).to.be.ok;
        expect(err.status).to.equal(401);
        expect(err.code).to.equal('unauthorized');
        expect(err).to.be.instanceOf(ManagementApiError);
      }
    });

    it('should handle unknown errors correctly', async () => {
      nock('https://tenant.auth0cluster.com')
        .post('/oauth/token')
        .reply(200, 'foo');

      try {
        await managementApi.getAccessToken('tenant.auth0cluster.com', 'myclient', 'mysecret');
        expect.fail('Should have thrown');
      } catch (err) {
        expect(err).to.be.ok;
        expect(err.status).to.be.ok;
        expect(err.status).to.equal(500); // ManagementApiError defaults to 500 when no status is provided
        expect(err.code).to.equal('unknown_error');
        expect(err).to.be.instanceOf(ManagementApiError);
      }
    });

    it('should handle forbidden errors correctly', async () => {
      nock('https://tenant.auth0cluster.com')
        .post('/oauth/token')
        .reply(403, {
          error: 'access_denied',
          error_description: 'Client is not authorized to access .... You might probably want to create a .. associated to this API.'
        });

      try {
        await managementApi.getAccessToken('tenant.auth0cluster.com', 'myclient', 'mysecret');
        expect.fail('Should have thrown');
      } catch (err) {
        expect(err).to.be.ok;
        expect(err.status).to.be.ok;
        expect(err.status).to.equal(403);
        expect(err.code).to.equal('access_denied');
        expect(err).to.be.instanceOf(ManagementApiError);
      }
    });

    it('should return access token', async () => {
      nock('https://tenant.auth0cluster.com')
        .post('/oauth/token')
        .reply(200, {
          access_token: 'abc'
        });

      const accessToken = await managementApi.getAccessToken('tenant.auth0cluster.com', 'myclient', 'mysecret');
      expect(accessToken).to.be.ok;
      expect(accessToken).to.equal('abc');
      
    });
  });

  describe('#getAccessTokenCached', () => {
    it('should cache the access token', async () => {
      nock('https://tenant.auth0cluster.com')
        .post('/oauth/token')
        .reply(200, {
          access_token: 'abc'
        });
      nock('https://tenant.auth0cluster2.com')
        .post('/oauth/token')
        .reply(200, {
          access_token: 'def'
        });

      const accessToken = await managementApi.getAccessTokenCached('tenant.auth0cluster.com', 'myclient', 'mysecret');
      expect(accessToken).to.be.ok;
      expect(accessToken).to.equal('abc');

      const accessToken2 = await managementApi.getAccessTokenCached('tenant.auth0cluster.com', 'myclient', 'mysecret');
      expect(accessToken2).to.be.ok;
      expect(accessToken2).to.equal('abc');

      const accessToken3 = await managementApi.getAccessTokenCached('tenant.auth0cluster2.com', 'myclient', 'mysecret');
      expect(accessToken3).to.be.ok;
      expect(accessToken3).to.equal('def');
      
    });

    it('should cache the access token based on its expiration', async function() {
      this.timeout(10000);

      const token = jwt.sign({ foo: 'bar' }, 'shhhhh', { expiresIn: '14s' });

      nock('https://tenant.auth0cluster3.com')
        .post('/oauth/token')
        .reply(200, {
          access_token: token
        });

      const accessToken = await managementApi.getAccessTokenCached('tenant.auth0cluster3.com', 'myclient', 'mysecret');
      expect(accessToken).to.be.ok;
      expect(accessToken).to.equal(token);

      await new Promise(resolve => setTimeout(resolve, 3000));

      const accessToken2 = await managementApi.getAccessTokenCached('tenant.auth0cluster3.com', 'myclient', 'mysecret');
      expect(accessToken2).to.be.ok;
      expect(accessToken2).to.equal(token);

      nock('https://tenant.auth0cluster3.com')
        .post('/oauth/token')
        .reply(200, {
          access_token: 'def'
        });

      await new Promise(resolve => setTimeout(resolve, 2000));

      const accessToken3 = await managementApi.getAccessTokenCached('tenant.auth0cluster3.com', 'myclient', 'mysecret');
      expect(accessToken3).to.be.ok;
      expect(accessToken3).to.equal('def');
      
    });

    it('should handle errors correctly', async () => {
      nock('https://tenant.auth0cluster.com')
        .post('/oauth/token')
        .reply(400, {
          error: 'foo'
        });

      try {
        await managementApi.getAccessTokenCached('tenant.auth0cluster.com', 'myclient', 'mysecret2');
        expect.fail('Should have thrown');
      } catch (err) {
        expect(err).to.be.ok;
        expect(err.code).to.equal('foo');
      }

      nock('https://tenant.auth0cluster.com')
        .post('/oauth/token')
        .reply(200, {
          access_token: 'abc'
        });

      const accessToken2 = await managementApi.getAccessTokenCached('tenant.auth0cluster.com', 'myclient', 'mysecret2');
      expect(accessToken2).to.be.ok;
      expect(accessToken2).to.equal('abc');
      
    });
  });

  describe('#getClient', () => {
    it('should validate options', async () => {
      try {
        managementApi.getClient();
        expect.fail('Should have thrown');
      } catch (err) {
        expect(err).to.be.ok;
        expect(err).to.be.instanceOf(ArgumentError);
      }

      try {
        managementApi.getClient({ });
        expect.fail('Should have thrown');
      } catch (err) {
        expect(err).to.be.ok;
        expect(err).to.be.instanceOf(ArgumentError);
      }

      try {
        managementApi.getClient({ domain: 1 });
        expect.fail('Should have thrown');
      } catch (err) {
        expect(err).to.be.ok;
        expect(err).to.be.instanceOf(ArgumentError);
      }

      try {
        managementApi.getClient({ domain: 'foo' });
        expect.fail('Should have thrown');
      } catch (err) {
        expect(err).to.be.ok;
        expect(err).to.be.instanceOf(ArgumentError);
      }

      try {
        managementApi.getClient({ domain: 'foo', accessToken: '' });
        expect.fail('Should have thrown');
      } catch (err) {
        expect(err).to.be.ok;
        expect(err).to.be.instanceOf(ArgumentError);
      }

      try {
        managementApi.getClient({ domain: 'foo', accessToken: 123 });
        expect.fail('Should have thrown');
      } catch (err) {
        expect(err).to.be.ok;
        expect(err).to.be.instanceOf(ArgumentError);
      }

      try {
        managementApi.getClient({ domain: 'foo', clientId: 123 });
        expect.fail('Should have thrown');
      } catch (err) {
        expect(err).to.be.ok;
        expect(err).to.be.instanceOf(ArgumentError);
      }

      try {
        managementApi.getClient({ domain: 'foo', clientId: 'abc' });
        expect.fail('Should have thrown');
      } catch (err) {
        expect(err).to.be.ok;
        expect(err).to.be.instanceOf(ArgumentError);
      }

      try {
        managementApi.getClient({ domain: 'foo', clientId: 'abc', clientSecret: 456 });
        expect.fail('Should have thrown');
      } catch (err) {
        expect(err).to.be.ok;
        expect(err).to.be.instanceOf(ArgumentError);
      }

      const auth0 = await managementApi.getClient({ domain: 'foo', accessToken: 'def' });
      expect(auth0).to.be.ok;
    });

    it('should create a client for accessToken', async () => {
      const auth0 = await managementApi.getClient({ domain: 'foo', accessToken: 'def' });
      expect(auth0).to.be.ok;
    });

    it('should create a client for accessToken with headers', async () => {
      const auth0 = await managementApi.getClient({ domain: 'foo', accessToken: 'def', headers: { customHeader: 'custom' } });
      expect(auth0).to.be.ok;
      const keys = Object.keys(auth0);
      keys.forEach(key => auth0[key].resource && expect(auth0[key].resource.restClient.options.headers.customHeader).to.equal('custom'));
    });

    it('should create a client for clientId/secret', async () => {
      nock('https://tenant.auth0cluster.com')
        .post('/oauth/token')
        .reply(200, {
          access_token: 'abc'
        });

      const auth0 = await managementApi.getClient({ domain: 'tenant.auth0cluster.com', clientId: 'abc', clientSecret: 'def' });
      expect(auth0).to.be.ok;
    });
  });
});
