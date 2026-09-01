export function ok(res, data = null, message = 'OK', status = 200) {
  return res.status(status).json({ success: true, data, message });
}

export function fail(res, message = 'Request failed', status = 400, code = null) {
  return res.status(status).json({ success: false, message, code, data: null });
}

export function notFound(res, message = 'Resource not found') {
  return fail(res, message, 404);
}

export function unauthorized(res, message = 'Authentication required') {
  return fail(res, message, 401);
}

export function forbidden(res, message = 'You do not have permission to perform this action') {
  return fail(res, message, 403);
}

export function serverError(res, message = 'Something went wrong on our side') {
  return fail(res, message, 500);
}
