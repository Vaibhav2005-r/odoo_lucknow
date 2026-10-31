// eslint-disable-next-line no-unused-vars
export function errorHandler(err, req, res, next) {
  if (err.code === 'P2002') {
    const field = [].concat(err.meta?.target ?? 'value').join(', ');
    return res.status(409).json({ error: { message: `This ${field} is already in use` } });
  }
  if (err.code === 'P2025') {
    return res.status(409).json({ error: { message: 'This record changed or no longer exists. Refresh and try again.' } });
  }
  if (err.code === 'P2003') {
    return res.status(409).json({ error: { message: 'This record is in use. Archive it instead of deleting.' } });
  }
  if (err.type === 'entity.parse.failed') {
    return res.status(400).json({ error: { message: 'Invalid JSON body' } });
  }
  const status = err.status || 500;
  if (status >= 500) console.error(err);
  return res.status(status).json({
    error: { message: status >= 500 ? 'Something went wrong on our side' : err.message, details: err.details },
  });
}
