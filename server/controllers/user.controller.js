import { userService } from '../services/user.service.js';
import { ok, fail, notFound } from '../utils/response.js';
import { db } from '../config/db.js';

function publicUser(u) {
  const role = db.prepare('SELECT name FROM roles WHERE id = ?').get(u.role_id);
  return {
    id: u.id, name: u.name, email: u.email, mobile: u.mobile,
    role: role ? role.name : 'USER', status: u.status,
    email_verified: !!u.email_verified, mobile_verified: !!u.mobile_verified,
  };
}

export function updateProfile(req, res) {
  try {
    const updated = userService.updateProfile(req.user.id, req.validated);
    if (!updated) return fail(res, 'Update failed', 400);
    return ok(res, { user: publicUser(updated) }, 'Profile updated');
  } catch (err) {
    if (err.message === 'CONFLICT') return fail(res, 'Email or mobile already in use', 409, 'CONFLICT');
    return fail(res, 'Could not update profile', 400);
  }
}

export function listAddresses(req, res) {
  return ok(res, userService.listAddresses(req.user.id));
}

export function addAddress(req, res) {
  const addr = userService.addAddress(req.user.id, req.validated);
  return ok(res, { address: addr }, 'Address added', 201);
}

export function deleteAddress(req, res) {
  const removed = userService.deleteAddress(req.user.id, Number(req.params.id));
  if (!removed) return notFound(res, 'Address not found');
  return ok(res, null, 'Address removed');
}
