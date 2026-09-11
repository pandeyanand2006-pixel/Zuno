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

export async function updateProfile(req, res) {
  try {
    const updated = await userService.updateProfile(req.user.id, req.validated);
    if (!updated) return fail(res, 'Update failed', 400);
    // publicUser helper needs to handle Mongo ObjectId case
    const isMongoDoc = updated._id || updated.role_name;
    if (isMongoDoc) {
      return ok(res, { user: { id: String(updated._id || updated.id), name: updated.name, email: updated.email, mobile: updated.mobile, role: updated.role_name || 'USER', status: updated.status } }, 'Profile updated');
    }
    return ok(res, { user: publicUser(updated) }, 'Profile updated');
  } catch (err) {
    if (err.message === 'CONFLICT') return fail(res, 'Email or mobile already in use', 409, 'CONFLICT');
    return fail(res, 'Could not update profile', 400);
  }
}

export async function listAddresses(req, res) {
  const list = await userService.listAddresses(req.user.id);
  return ok(res, list);
}

export async function addAddress(req, res) {
  const addr = await userService.addAddress(req.user.id, req.validated);
  return ok(res, { address: addr }, 'Address added', 201);
}

export async function deleteAddress(req, res) {
  const removed = await userService.deleteAddress(req.user.id, req.params.id);
  if (!removed) return notFound(res, 'Address not found');
  return ok(res, null, 'Address removed');
}
