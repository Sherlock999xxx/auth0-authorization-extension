class ArgumentError extends Error {
  constructor(message) {
    super(message);
    this.name = 'ArgumentError';
    this.status = 400;
    this.statusCode = 400;
    Error.captureStackTrace(this, this.constructor);
  }
}

module.exports = ArgumentError;
