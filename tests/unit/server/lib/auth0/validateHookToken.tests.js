import { expect } from 'chai';
import HookTokenError from '../../../../../server/lib/errors/HookTokenError';
import validateHookToken from '../../../../../server/lib/auth0/validateHookToken';

describe('validateHookToken', () => {
  it('should require a token', () => {
    try {
      validateHookToken();
      expect.fail('Should have thrown');
    } catch (e) {
      expect(e).to.be.ok;
      expect(e).to.be.instanceOf(HookTokenError);
    }
  });

  it('should reject invalid tokens', () => {
    try {
      validateHookToken('me.auth0.com', 'https://webtask.io/run/abc', '/extension/uninstall', 'mysecret', 'faketoken');
      expect.fail('Should have thrown');
    } catch (e) {
      expect(e).to.be.ok;
      expect(e).to.be.instanceOf(HookTokenError);
      expect(e.innerError).to.be.ok;
    }
  });

  it('should accept valid tokens', () => {
    const isValid = validateHookToken('me.auth0.com', 'https://webtask.io/run/abc', '/extension/uninstall', 'mysecret',
      'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJodHRwczovL21lLmF1dGgwLmNvbSIsImF1ZCI6Imh0dHBzOi8vd2VidGFzay5pby9ydW4vYWJjL2V4dGVuc2lvbi91bmluc3RhbGwifQ.fdAaM7cLdirmv4KyQ46Vq4eat04gRb7KWi8kpQAhA-Q');
    expect(isValid).to.be.ok;
  });
});
