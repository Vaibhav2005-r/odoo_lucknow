import { httpError } from '../lib/http-error.js';

// Express 5: req.query is read-only, so parsed query/params go to req.valid.
export const validate = (schema, source = 'body') => (req, res, next) => {
  const r = schema.safeParse(req[source] ?? {});
  if (!r.success) {
    return next(httpError(422, 'Please fix the highlighted fields', r.error.flatten().fieldErrors));
  }
  if (source === 'body') req.body = r.data;
  else req.valid = { ...(req.valid || {}), [source]: r.data };
  return next();
};
