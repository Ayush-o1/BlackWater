// An error we threw on purpose (bad input, missing record, no permission).
// The error handler shows its message to the client; anything that is not an
// AppError is treated as a bug and its details stay in the server log.
export class AppError extends Error {
  constructor(message, statusCode, isOperational = true) {
    super(message);
    this.statusCode = statusCode;
    this.isOperational = isOperational;
    Error.captureStackTrace(this, this.constructor);
  }
}
