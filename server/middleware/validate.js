import { fail } from '../utils/response.js';

export function validate(schema, source = 'body') {
  return (req, res, next) => {
    const data = source === 'query' ? req.query : source === 'params' ? req.params : req.body;
    const result = schema.safeParse(data);
    if (!result.success) {
      const message = result.error.issues.map((i) => `${i.path.join('.') || 'field'}: ${i.message}`).join('; ');
      return fail(res, message || 'Validation failed', 422, 'VALIDATION_ERROR');
    }
    req.validated = result.data;
    next();
  };
}
