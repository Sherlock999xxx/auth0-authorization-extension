class ValidationError extends Error {
  constructor(message) {
    super(message);
    this.name = 'ValidationError';
    this.status = 400;
    this.statusCode = 400;
    Error.captureStackTrace(this, this.constructor);
  }
}

module.exports = ValidationError;
