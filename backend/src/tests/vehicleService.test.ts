import path from 'node:path';
import { jest } from '@jest/globals';

/**
 * Robust in-file mock for `fs`:
 * - Works regardless of absolute/relative path and Windows/Unix slashes
 * - Any path that ends with "vehicles.json" will read from the current seed
 * - Writes are kept per-normalized path in `mem` (useful if you want to assert persistence)
 */
type MemMap = Record<string, string>;
const mem: MemMap = {};
let seededVehiclesJson = '[]';
const writeCalls: Array<{ path: string; data: string }> = [];

jest.mock('fs', () => {
  return {
    __esModule: true,
    default: {
      readFileSync: (p: string, enc: BufferEncoding = 'utf-8') => {
        const norm = path.normalize(String(p)).toLowerCase();
        if (mem[norm] != null) return mem[norm];

        // If it's the vehicles.json file (no matter where), return the seed:
        const vehiclesName = path.normalize('vehicles.json').toLowerCase();
        if (norm.endsWith(vehiclesName)) {
          return seededVehiclesJson;
        }

        throw new Error(`ENOENT: ${p}`);
      },
      writeFileSync: (p: string, data: string) => {
        const norm = path.normalize(String(p)).toLowerCase();
        const s = typeof data === 'string' ? data : String(data);
        mem[norm] = s;
        writeCalls.push({ path: norm, data: s });
      }
    }
  };
});

/** Seed helper: sets what any "*vehicles.json" read will return initially
 *  and also overwrites the in-memory file at the virtual DATA_PATH.
 */
function seedVehiclesFile(objs: any[]) {
  const json = JSON.stringify(objs, null, 2);
  seededVehiclesJson = json;
  writeCalls.length = 0;

  // ALSO override the specific virtual file path used by loadService()
  const virtualPath = path.normalize(path.resolve('virtual', 'vehicles.json')).toLowerCase();
  mem[virtualPath] = json; // <-- this line ensures fresh seed per test
}


/** Load a fresh copy of the service so its top-level `readFileSync` runs against the current seed */
async function loadService() {
  // Point the service to some path; it will be normalized anyway.
  process.env.DATA_PATH = path.resolve('virtual', 'vehicles.json');

  // Ensure the module's top-level code re-executes each test
  jest.resetModules();

  // Adjust import path if your service file is elsewhere:
  const service = await import('../services/vehicleService');
  // We keep the type as any to avoid tight coupling in tests
  return service as unknown as {
    createVehicle: (licensePlate: string, model: string) => any; // Result<Vehicle>
    listVehicles: () => any[];                                   // Vehicle[]
    editVehicleStatus: (licensePlate: string, status: string) => any; // Result<Vehicle>
    editVehicle: (id: string, newLicensePlate: string) => any;   // Result<Vehicle>
    deleteVehicle: (id: string) => any;                          // Result<{ deletedId: string }>
  };
}

/** Base data (already normalized license plates) */
const baseVehicles = [
  {
    id: '1',
    licensePlate: '11AAA11',
    model: 'Model-A',
    status: 'Available',
    createdAt: '2025-01-01T00:00:00.000Z'
  },
  {
    id: '2',
    licensePlate: '22BBB22',
    model: 'Model-B',
    status: 'InUse',
    createdAt: '2025-01-02T00:00:00.000Z'
  }
];

describe('vehicleService: createVehicle & listVehicles', () => {
  beforeEach(() => {
    seedVehiclesFile(baseVehicles);
  });

  test('listVehicles returns what is loaded from the JSON file', async () => {
    const service = await loadService();

    const list = service.listVehicles();
    expect(Array.isArray(list)).toBe(true);
    expect(list).toHaveLength(2);
    expect(list[0]).toMatchObject({
      id: '1',
      licensePlate: '11AAA11',
      status: 'Available'
    });
  });

  test('createVehicle adds a new vehicle, normalizes plate, defaults status=Available, and persists', async () => {
    const service = await loadService();

    const res = service.createVehicle(' 22-bbb-33 ', 'Kawasaki-300X');
    expect(res.ok).toBe(true);
    if (res.ok) {
      expect(res.data).toMatchObject({
        model: 'Kawasaki-300X',
        licensePlate: '22BBB33',
        status: 'Available'
      });
      expect(res.data.id).toMatch(/^v\d+/);
      expect(typeof res.data.createdAt).toBe('string');
    }

    // Verify in-memory list includes the new item
    const after = service.listVehicles();
    expect(after).toHaveLength(3);
    expect(after.some(v => v.licensePlate === '22BBB33')).toBe(true);

    // Verify that a write occurred with 3 items
    expect(writeCalls.length).toBeGreaterThanOrEqual(1);
    const last = writeCalls[writeCalls.length - 1];
    const persisted = JSON.parse(last.data);
    expect(persisted).toHaveLength(3);
  });

  test('createVehicle rejects plates shorter than 5 after normalization', async () => {
    const service = await loadService();
    const res = service.createVehicle('a-b 1', 'M1'); // "AB1" -> length 3 -> invalid
    expect(res.ok).toBe(false);
    if (!res.ok) {
      expect(res.error.code).toBe('INVALID_LICENSE_PLATE');
    }
  });

  test('createVehicle rejects plates longer than 10 after normalization', async () => {
    const service = await loadService();
    // 11-AAAA-22-BBBB -> "11AAAA22BBBB" (length 12) -> invalid
    const res = service.createVehicle('11-AAAA-22-BBBB', 'M2');
    expect(res.ok).toBe(false);
    if (!res.ok) {
      expect(res.error.code).toBe('INVALID_LICENSE_PLATE');
    }
  });

  test('createVehicle returns LICENSE_PLATE_REQUIRED when plate is missing', async () => {
    const service = await loadService();
    const res = service.createVehicle('', 'SomeModel');
    expect(res.ok).toBe(false);
    if (!res.ok) {
      expect(res.error.code).toBe('LICENSE_PLATE_REQUIRED');
    }
  });

  test('createVehicle returns MODEL_REQUIRED when model is missing', async () => {
    const service = await loadService();
    const res = service.createVehicle('99-xyz-99', '');
    expect(res.ok).toBe(false);
    if (!res.ok) {
      expect(res.error.code).toBe('MODEL_REQUIRED');
    }
  });

  test('createVehicle prevents duplicates by normalized plate', async () => {
    const service = await loadService();

    // baseVehicles already has 11AAA11; this input normalizes to the same
    const res = service.createVehicle('11-aaa-11', 'AnyModel');
    expect(res.ok).toBe(false);
    if (!res.ok) {
      expect(res.error.code).toBe('DUPLICATE_LICENSE_PLATE');
    }
  });
});

// --------------------
// Edit status tests
// --------------------
describe('vehicleService: editVehicleStatus', () => {
  beforeEach(() => {
    // start each test with the same 2 vehicles seed
    seedVehiclesFile(baseVehicles);
  });

  test('changes status for an existing vehicle and persists to file', async () => {
    const service = await loadService();

    // change 22BBB22 (id "2") from InUse -> Maintenance
    const updated = service.editVehicleStatus('22-bbb-22', 'Maintenance');
    expect(updated.ok).toBe(true);
    if (updated.ok) {
      expect(updated.data).toMatchObject({
        licensePlate: '22BBB22', // input is normalized internally
        status: 'Maintenance'
      });
    }

    // list should reflect the change
    const after = service.listVehicles();
    const v2 = after.find(v => v.licensePlate === '22BBB22');
    expect(v2).toBeTruthy();
    expect(v2!.status).toBe('Maintenance');

    // ensure a write happened and contains the updated status
    expect(writeCalls.length).toBeGreaterThanOrEqual(1);
    const lastWrite = writeCalls[writeCalls.length - 1];
    const persisted = JSON.parse(lastWrite.data) as Array<any>;
    const persistedV2 = persisted.find(v => v.licensePlate === '22BBB22');
    expect(persistedV2).toBeTruthy();
    expect(persistedV2!.status).toBe('Maintenance');
  });

  test('normalizes plate before lookup (e.g., "11-aaa-11" matches "11AAA11")', async () => {
    const service = await loadService();

    const updated = service.editVehicleStatus(' 11-aaa-11 ', 'InUse');
    expect(updated.ok).toBe(true);
    if (updated.ok) {
      expect(updated.data.licensePlate).toBe('11AAA11');
      expect(updated.data.status).toBe('InUse');
    }
  });

  test('returns INVALID_STATUS when new status is invalid', async () => {
    const service = await loadService();

    const res = service.editVehicleStatus('11-AAA-11', 'Broken' as any);
    expect(res.ok).toBe(false);
    if (!res.ok) {
      expect(res.error.code).toBe('INVALID_STATUS');
    }
  });

  test('returns VEHICLE_NOT_FOUND if vehicle not found', async () => {
    const service = await loadService();

    const res = service.editVehicleStatus('00-XXX-00', 'Available');
    expect(res.ok).toBe(false);
    if (!res.ok) {
      expect(res.error.code).toBe('VEHICLE_NOT_FOUND');
    }
  });

  test('no-op when target equals current (no state change, no write)', async () => {
    const service = await loadService();

    // 11AAA11 starts as Available in baseVehicles
    const before = service.listVehicles().find(v => v.licensePlate === '11AAA11')!;
    const returned = service.editVehicleStatus(' 11-aaa-11 ', 'Available');
    expect(returned.ok).toBe(true);
    if (returned.ok) {
      // Same object instance and unchanged status
      expect(returned.data).toBe(before);
      expect(returned.data.status).toBe('Available');
    }
  });

  test('Maintenance -> only Allowed to Available (illegal otherwise)', async () => {
    const service = await loadService();

    // First move a vehicle into Maintenance (legal)
    const m = service.editVehicleStatus('11-aaa-11', 'Maintenance');
    expect(m.ok).toBe(true);

    // Any transition out of Maintenance that is not to Available should be rejected
    const illegal = service.editVehicleStatus('11-aaa-11', 'InUse');
    expect(illegal.ok).toBe(false);
    if (!illegal.ok) {
      expect(illegal.error.code).toBe('ILLEGAL_STATUS_TRANSITION');
    }
  });

  test('Maintenance -> Available is allowed', async () => {
    const service = await loadService();

    // Move to Maintenance
    const toM = service.editVehicleStatus('11-aaa-11', 'Maintenance');
    expect(toM.ok).toBe(true);

    // Move back to Available (the only legal transition out of Maintenance)
    const toA = service.editVehicleStatus('11-aaa-11', 'Available');
    expect(toA.ok).toBe(true);
    if (toA.ok) {
      expect(toA.data.status).toBe('Available');
    }
  });

  test('5% Maintenance cap enforced (min 1)', async () => {
    // Build a 20-vehicle fleet → cap = max(1, floor(20*0.05)) = 1
    const fleet = Array.from({ length: 20 }, (_, i) => ({
      id: String(i + 1),
      licensePlate: `PLATE${i + 1}`,
      model: `M-${i + 1}`,
      status: 'Available',
      createdAt: '2025-01-01T00:00:00.000Z'
    }));
    seedVehiclesFile(fleet);
    const service = await loadService();

    // First vehicle to Maintenance is allowed
    const v1 = service.editVehicleStatus('PLATE1', 'Maintenance');
    expect(v1.ok).toBe(true);

    // Second should exceed the 5% cap and be rejected
    const v2 = service.editVehicleStatus('PLATE2', 'Maintenance');
    expect(v2.ok).toBe(false);
    if (!v2.ok) {
      expect(v2.error.code).toBe('MAINTENANCE_CAP_EXCEEDED');
    }
  });
});

// --------------------
// Edit license plate tests
// --------------------
describe('vehicleService: editVehicle', () => {
  beforeEach(() => {
    // Start every test from the same 2-vehicle seed
    seedVehiclesFile([
      {
        id: '1',
        licensePlate: '11AAA11',
        model: 'Model-A',
        status: 'Available',
        createdAt: '2025-01-01T00:00:00.000Z'
      },
      {
        id: '2',
        licensePlate: '22BBB22',
        model: 'Model-B',
        status: 'InUse',
        createdAt: '2025-01-02T00:00:00.000Z'
      }
    ]);
  });

  test('updates license plate when id exists and new plate is unique (normalized) and persists', async () => {
    const service = await loadService();
    const beforeWrites = writeCalls.length;

    // id=1 currently "11AAA11"; change to a unique normalized plate
    const res = service.editVehicle('1', ' 99-zzz-99 ');
    expect(res.ok).toBe(true);
    if (res.ok) {
      expect(res.data.id).toBe('1');
      expect(res.data.licensePlate).toBe('99ZZZ99'); // normalized
    }

    // In-memory list reflects the change
    const after = service.listVehicles();
    const v1 = after.find(v => v.id === '1')!;
    expect(v1.licensePlate).toBe('99ZZZ99');

    // Persistence happened
    expect(writeCalls.length).toBeGreaterThan(beforeWrites);
    const lastWrite = writeCalls[writeCalls.length - 1];
    const persisted = JSON.parse(lastWrite.data);
    const persistedV1 = persisted.find((v: any) => v.id === '1');
    expect(persistedV1.licensePlate).toBe('99ZZZ99');
  });

  test('returns VEHICLE_NOT_FOUND if vehicle id does not exist', async () => {
    const service = await loadService();

    const res = service.editVehicle('NO_SUCH_ID', '99ZZZ99');
    expect(res.ok).toBe(false);
    if (!res.ok) {
      expect(res.error.code).toBe('VEHICLE_NOT_FOUND');
    }
  });

  test('returns DUPLICATE_LICENSE_PLATE when new normalized plate duplicates another vehicle', async () => {
    const service = await loadService();
    const beforeWrites = writeCalls.length;

    // id=2 has "22BBB22"; "22-bbb-22" normalizes to the same value → duplicate
    const res = service.editVehicle('1', ' 22-bbb-22 ');
    expect(res.ok).toBe(false);
    if (!res.ok) {
      expect(res.error.code).toBe('DUPLICATE_LICENSE_PLATE');
    }

    // Nothing changed in memory for vehicle 1
    const after = service.listVehicles();
    const v1 = after.find(v => v.id === '1')!;
    expect(v1.licensePlate).toBe('11AAA11');

    // No persistence on duplicate
    expect(writeCalls.length).toBe(beforeWrites);
  });

  test('returns INVALID_LICENSE_PLATE on invalid plate (after normalization)', async () => {
    const service = await loadService();

    // Too short after normalization: "a-1" -> "A1" (len 2)
    const tooShort = service.editVehicle('1', 'a-1');
    expect(tooShort.ok).toBe(false);
    if (!tooShort.ok) {
      expect(tooShort.error.code).toBe('INVALID_LICENSE_PLATE');
    }

    // Too long after normalization: "11-AAAA-22-BBBB" -> "11AAAA22BBBB" (len 12)
    const tooLong = service.editVehicle('1', '11-AAAA-22-BBBB');
    expect(tooLong.ok).toBe(false);
    if (!tooLong.ok) {
      expect(tooLong.error.code).toBe('INVALID_LICENSE_PLATE');
    }

    // Non-alphanumeric -> normalization leaves "", still invalid
    const nonAlnum = service.editVehicle('1', '***@@@###');
    expect(nonAlnum.ok).toBe(false);
    if (!nonAlnum.ok) {
      expect(nonAlnum.error.code).toBe('INVALID_LICENSE_PLATE');
    }
  });

  test('no-op when same normalized plate; success otherwise and persists', async () => {
    const service = await loadService();

    // Same normalized plate (adding spaces/dashes) -> no-op, no write
    const beforeWrites = writeCalls.length;
    const same = service.editVehicle('1', ' 11-aaa-11 ');
    expect(same.ok).toBe(true);
    if (same.ok) {
      expect(same.data.licensePlate).toBe('11AAA11');
    }
    expect(writeCalls.length).toBe(beforeWrites); // no persistence on no-op

    // Now change to a different unique plate -> write occurs
    const updated = service.editVehicle('1', '55-xxx-55');
    expect(updated.ok).toBe(true);
    if (updated.ok) {
      expect(updated.data.licensePlate).toBe('55XXX55');
    }
    expect(writeCalls.length).toBeGreaterThan(beforeWrites);
  });
});

// --------------------
// Delete vehicle tests
// --------------------
describe('vehicleService: deleteVehicle', () => {
  // Explicit 3-vehicle seed for this describe:
  const seed3 = [
    { id: '1', licensePlate: '11AAA11', model: 'Model-A', status: 'Available',   createdAt: '2025-01-01T00:00:00.000Z' },
    { id: '2', licensePlate: '22BBB22', model: 'Model-B', status: 'InUse',       createdAt: '2025-01-02T00:00:00.000Z' },
    { id: '3', licensePlate: '33CCC33', model: 'Model-C', status: 'Maintenance', createdAt: '2025-01-03T00:00:00.000Z' }
  ];

  beforeEach(() => {
    seedVehiclesFile(seed3);
  });

  test('deletes vehicle only when status is Available and persists', async () => {
    const service = await loadService();

    // id=1 is Available
    const res = service.deleteVehicle('1');
    expect(res.ok).toBe(true);
    if (res.ok) {
      expect(res.data.deletedId).toBe('1');
    }

    const after = service.listVehicles();
    expect(after.some(v => v.id === '1')).toBe(false);
    expect(after).toHaveLength(2); // started with 3, deleted 1

    // Persistence occurred with updated array of length 2
    expect(writeCalls.length).toBeGreaterThanOrEqual(1);
    const lastWrite = writeCalls[writeCalls.length - 1];
    const persisted = JSON.parse(lastWrite.data);
    expect(persisted).toHaveLength(2);
    expect(persisted.some((v: any) => v.id === '1')).toBe(false);
  });

  test('returns NOT_ALLOWED_STATUS_FOR_DELETE when trying to delete InUse', async () => {
    const service = await loadService();

    // id=2 is InUse
    const res = service.deleteVehicle('2');
    expect(res.ok).toBe(false);
    if (!res.ok) {
      expect(res.error.code).toBe('NOT_ALLOWED_STATUS_FOR_DELETE');
    }

    const after = service.listVehicles();
    expect(after).toHaveLength(3); // unchanged
    expect(after.some(v => v.id === '2')).toBe(true);
  });

  test('returns NOT_ALLOWED_STATUS_FOR_DELETE when trying to delete Maintenance', async () => {
    const service = await loadService();

    // id=3 is Maintenance
    const res = service.deleteVehicle('3');
    expect(res.ok).toBe(false);
    if (!res.ok) {
      expect(res.error.code).toBe('NOT_ALLOWED_STATUS_FOR_DELETE');
    }

    const after = service.listVehicles();
    expect(after).toHaveLength(3); // unchanged
    expect(after.some(v => v.id === '3')).toBe(true);
  });

  test('returns VEHICLE_NOT_FOUND when id does not exist', async () => {
    const service = await loadService();

    const res = service.deleteVehicle('NO_SUCH_ID');
    expect(res.ok).toBe(false);
    if (!res.ok) {
      expect(res.error.code).toBe('VEHICLE_NOT_FOUND');
    }

    const after = service.listVehicles();
    expect(after).toHaveLength(3); // unchanged
  });
});

export { writeCalls }; // exported for potential extra assertions in other files
