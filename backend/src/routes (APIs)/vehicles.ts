import { Router } from 'express';
import {
  createVehicle,
  listVehicles,
  editVehicleStatus,
  editVehicle,
  deleteVehicle
} from '../services/vehicleService';
import { ServiceErrorCode } from '../models/structures';

const router = Router();

/** Map service error codes to HTTP status codes */
function toHttpStatus(code: ServiceErrorCode): number {
  switch (code) {
    case 'LICENSE_PLATE_REQUIRED':
    case 'MODEL_REQUIRED':
    case 'INVALID_LICENSE_PLATE':
    case 'INVALID_STATUS':
      return 400; // Bad Request
    case 'DUPLICATE_LICENSE_PLATE':
    case 'ILLEGAL_STATUS_TRANSITION':
    case 'MAINTENANCE_CAP_EXCEEDED':
    case 'NOT_ALLOWED_STATUS_FOR_DELETE':
      return 409; // Conflict
    case 'VEHICLE_NOT_FOUND':
      return 404; // Not Found
    case 'ADMIN_APPROVAL_REQUIRED':
      return 403; // Forbidden
    default:
      return 500;

  }
}

/** Uniform sender for Result<T> */
function sendResult<T>(res: any, result: any, successStatus: number = 200) {
  if (result.ok) {
    return res.status(successStatus).json(result.data);
  }
  const status = toHttpStatus(result.error.code);
  return res.status(status).json({ error: result.error });
}

/** GET /api/vehicles -> list all vehicles */
router.get('/', (_req, res) => {
  // listVehicles returns a plain array (not a Result)
  const data = listVehicles();
  return res.json(data);
});

/** POST /api/vehicles -> create a vehicle */
router.post('/', (req, res) => {
  const { licensePlate, model } = req.body || {};
  const r = createVehicle(licensePlate, model);
  return sendResult(res, r, 201);
});

/** PATCH /api/vehicles/:licensePlate/status -> change status */
router.patch('/:licensePlate/status', (req, res) => {
  const { licensePlate } = req.params;
  const { status } = req.body || {};
  const r = editVehicleStatus(licensePlate, status);
  return sendResult(res, r);
});

/** PATCH /api/vehicles/:id/plate -> change license plate */
router.patch('/:id/plate', (req, res) => {
  const { id } = req.params;
  const { licensePlate } = req.body || {};
  const r = editVehicle(id, licensePlate);
  return sendResult(res, r);
});


/** DELETE /api/vehicles/:id -> requires admin token + only if Available */
router.delete('/:id', (req, res) => {
  // Simple admin approval via header
  const token = req.header('x-admin-token');
  const expected = process.env.ADMIN_DELETE_TOKEN; // set in your env
  if (!expected || token !== expected) {
    // Consistent error shape with other endpoints
    return res.status(403).json({
      error: { code: 'ADMIN_APPROVAL_REQUIRED', message: 'Admin approval required' }
    });
  }

  const { id } = req.params;
  const r = deleteVehicle(id);
  if (r.ok) return res.json(r.data);

  // Map service errors (existing switch)
  const status = toHttpStatus(r.error.code);
  return res.status(status).json({ error: r.error });
});

export default router;
