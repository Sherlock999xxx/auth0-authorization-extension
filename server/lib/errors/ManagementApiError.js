class ManagementApiError extends Error {
  constructor(code, message, statusCode) {
    super(message);
    this.name = 'ManagementApiError';
    this.code = code;
    this.status = statusCode || 500;
    this.statusCode = statusCode || 500;
    Error.captureStackTrace(this, this.constructor);
  }
}

module.exports = ManagementApiError;
