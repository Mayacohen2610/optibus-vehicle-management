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

/** DELETE /api/vehicles/:id -> delete if Available */
router.delete('/:id', (req, res) => {
  const { id } = req.params;
  const r = deleteVehicle(id);
  return sendResult(res, r);
});

export default router;
