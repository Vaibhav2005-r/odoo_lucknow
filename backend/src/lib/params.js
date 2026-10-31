import { httpError } from './http-error.js';

export function paramId(req, name = 'id') {
  const n = Number(req.params[name]);
  if (!Number.isInteger(n) || n < 1) throw httpError(400, 'Invalid id');
  return n;
}

export function paginate(query) {
  const page = Math.max(1, Number.parseInt(query.page, 10) || 1);
  const pageSize = Math.min(100, Math.max(1, Number.parseInt(query.pageSize, 10) || 20));
  return { page, pageSize, skip: (page - 1) * pageSize, take: pageSize };
}
