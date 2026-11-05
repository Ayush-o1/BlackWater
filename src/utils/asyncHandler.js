// Express 4 does not catch rejected promises from async handlers on its own.
// Wrapping a handler forwards any thrown error to the error middleware.
export const asyncHandler = (handler) => (req, res, next) => {
  Promise.resolve(handler(req, res, next)).catch(next);
};
