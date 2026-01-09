const ArgumentError = require('./ArgumentError');
const ValidationError = require('./ValidationError');
const HookTokenError = require('./HookTokenError');
const NotFoundError = require('./NotFoundError');
const ManagementApiError = require('./ManagementApiError');
const UnauthorizedError = require('./UnauthorizedError');
const ForbiddenError = require('./ForbiddenError');

// CommonJS exports
module.exports = {
  ArgumentError,
  ValidationError,
  HookTokenError,
  NotFoundError,
  ManagementApiError,
  UnauthorizedError,
  ForbiddenError
};

// ES6 named exports for compatibility
module.exports.ArgumentError = ArgumentError;
module.exports.ValidationError = ValidationError;
module.exports.HookTokenError = HookTokenError;
module.exports.NotFoundError = NotFoundError;
module.exports.ManagementApiError = ManagementApiError;
module.exports.UnauthorizedError = UnauthorizedError;
module.exports.ForbiddenError = ForbiddenError;
