const errorHandler = (err, req, res, next) => {
  const statusCode = err.statusCode || err.status || 500;

  console.error(`[error] ${req.method} ${req.path} ${statusCode}: ${err.message}`);

  return res.status(statusCode).json({
    error: err.name || 'InternalServerError',
    message: err.message || 'An unexpected error occurred',
  });
};

export class AppError extends Error {
  constructor(message, statusCode = 500, name = 'AppError') {
    super(message);
    this.statusCode = statusCode;
    this.name = name;
  }
}

export default errorHandler;
