class HookTokenError extends Error {
  constructor(message, innerError) {
    super(message);
    this.name = 'HookTokenError';
    this.status = 401;
    this.statusCode = 401;
    this.innerError = innerError;
    Error.captureStackTrace(this, this.constructor);
  }
}

module.exports = HookTokenError;
