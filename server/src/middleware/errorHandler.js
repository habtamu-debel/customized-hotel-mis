import { ZodError } from 'zod';

export const errorHandler = (err, req, res, next) => {
  if (res.headersSent) return next(err);
  console.error(err);

  if (err instanceof ZodError) {
    return res.status(400).json({
      success: false,
      message: err.errors[0]?.message || 'Check the form and try again.',
    });
  }

  if (err.code === 'ER_DUP_ENTRY') {
    return res.status(409).json({ success: false, message: 'That record already exists.' });
  }

  const status = err.statusCode || 500;
  res.status(status).json({
    success: false,
    message: status === 500 ? 'Something went wrong. Please try again.' : err.message,
  });
};

export const notFound = (req, res) => {
  res.status(404).json({ success: false, message: 'Route not found.' });
};
