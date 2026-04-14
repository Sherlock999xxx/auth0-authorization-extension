const { ArgumentError } = require('../lib/errors');
const managementApi = require('../lib/auth0/managementApi');

export default function(handlerOptions) {
  if (!handlerOptions || typeof handlerOptions !== 'object') {
    throw new ArgumentError('Must provide the options');
  }

  if (typeof handlerOptions.domain !== 'string' || handlerOptions.domain.length === 0) {
    throw new ArgumentError('The provided domain is invalid: ' + handlerOptions.domain);
  }

  return {
    method: async function(req, h) {
      const isAdministrator = req.auth && req.auth.credentials && req.auth.credentials.access_token && req.auth.credentials.access_token.length;
      const options = !isAdministrator ? handlerOptions : {
        domain: handlerOptions.domain,
        accessToken: req.auth.credentials.access_token
      };

      const auth0 = await managementApi.getClient(options);
      return auth0;
    },
    assign: 'auth0'
  };
}
