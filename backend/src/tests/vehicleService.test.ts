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
  return service as unknown as {
    createVehicle: (licensePlate: string, model: string) => any;
    listVehicles: () => any[];
    editVehicleStatus: (licensePlate: string, status: string) => any; 
    editVehicle: (id: string, newLicensePlate: string) => any | null;
    deleteVehicle: (id: string) => boolean;
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

    const created = service.createVehicle(' 22-bbb-33 ', 'Kawasaki-300X');
    expect(created).toMatchObject({
      model: 'Kawasaki-300X',
      licensePlate: '22BBB33',
      status: 'Available'
    });
    expect(created.id).toMatch(/^v\d+/);
    expect(typeof created.createdAt).toBe('string');

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

  test('createVehicle throws if licensePlate is missing', async () => {
    const service = await loadService();
    expect(() => service.createVehicle('', 'SomeModel'))
      .toThrow(/licensePlate is required/i);
  });

  test('createVehicle throws if model is missing', async () => {
    const service = await loadService();
    expect(() => service.createVehicle('99-xyz-99', ''))
      .toThrow(/model is required/i);
  });

  test('createVehicle prevents duplicates by normalized plate', async () => {
    const service = await loadService();

    // baseVehicles already has 11AAA11; this input normalizes to the same
    expect(() => service.createVehicle('11-aaa-11', 'AnyModel'))
      .toThrow(/already exists/i);
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

    // returned object is the mutated vehicle
    expect(updated).toMatchObject({
      licensePlate: '22BBB22', // input is normalized internally
      status: 'Maintenance'
    });

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
    expect(updated.licensePlate).toBe('11AAA11');
    expect(updated.status).toBe('InUse');
  });

  test('throws if new status is invalid', async () => {
    const service = await loadService();

    // invalid status should match the service error message
    expect(() => service.editVehicleStatus('11-AAA-11', 'Broken' as any))
      .toThrow(/invalid vehicle status/i);
  });

  test('throws if vehicle not found', async () => {
    const service = await loadService();

    expect(() => service.editVehicleStatus('00-XXX-00', 'Available'))
      .toThrow(/vehicle not found/i);
  });

  test('no-op when target equals current (no state change, no throw)', async () => {
  const service = await loadService();

  // 11AAA11 starts as Available in baseVehicles
  const before = service.listVehicles().find(v => v.licensePlate === '11AAA11')!;
  const returned = service.editVehicleStatus(' 11-aaa-11 ', 'Available');

  // Same object instance and unchanged status
  expect(returned).toBe(before);
  expect(returned.status).toBe('Available');
});

test('Maintenance -> only Allowed to Available (illegal otherwise)', async () => {
  const service = await loadService();

  // First move a vehicle into Maintenance (legal)
  const m = service.editVehicleStatus('11-aaa-11', 'Maintenance');
  expect(m.status).toBe('Maintenance');

  // Any transition out of Maintenance that is not to Available should throw
  expect(() => service.editVehicleStatus('11-aaa-11', 'InUse'))
    .toThrow(/maintenance.*allowed.*available/i);
});

test('Maintenance -> Available is allowed', async () => {
  const service = await loadService();

  // Move to Maintenance
  service.editVehicleStatus('11-aaa-11', 'Maintenance');

  // Move back to Available (the only legal transition out of Maintenance)
  const updated = service.editVehicleStatus('11-aaa-11', 'Available');
  expect(updated.status).toBe('Available');
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
  expect(v1.status).toBe('Maintenance');

  // Second should exceed the 5% cap and throw
  expect(() => service.editVehicleStatus('PLATE2', 'Maintenance'))
    .toThrow(/cap/i);
});

});

// --------------------
// Edit license plate tests
// --------------------
describe('vehicleService: editVehicle', () => {
  beforeEach(() => {
    // start every test from the same seed of 2 vehicles
    seedVehiclesFile(baseVehicles);
  });

  test('updates license plate when id exists and new plate is unique', async () => {
    const service = await loadService();

    // Base has: 11AAA11 (id=1), 22BBB22 (id=2)
    const updated = service.editVehicle('1', '99ZZZ99');
    expect(updated).toBeTruthy();
    expect(updated!.licensePlate).toBe('99ZZZ99');

    // list reflects the change
    const after = service.listVehicles();
    const v1 = after.find(v => v.id === '1');
    expect(v1).toBeTruthy();
    expect(v1!.licensePlate).toBe('99ZZZ99');
  });

  test('returns null if vehicle id does not exist', async () => {
    const service = await loadService();

    const res = service.editVehicle('NO_SUCH_ID', '99ZZZ99');
    expect(res).toBeNull();
  });

  test('returns null if new license plate already exists on another vehicle', async () => {
    const service = await loadService();

    // new plate equals existing plate of id=2
    const res = service.editVehicle('1', '22BBB22');
    expect(res).toBeNull();

    // verify nothing changed
    const after = service.listVehicles();
    const v1 = after.find(v => v.id === '1')!;
    expect(v1.licensePlate).toBe('11AAA11');
  });

  test('NOTE: no normalization is applied in editVehicle (current behavior)', async () => {
    const service = await loadService();

    // "22-bbb-22" is NOT equal to "22BBB22" (no normalization in editVehicle),
    // so this will be considered unique and allowed.
    const updated = service.editVehicle('1', '22-bbb-22');
    expect(updated).toBeTruthy();
    expect(updated!.licensePlate).toBe('22-bbb-22');
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

  test('deletes vehicle only when status is Available', async () => {
    const service = await loadService();

    // id=1 is Available
    const ok = service.deleteVehicle('1');
    expect(ok).toBe(true);

    const after = service.listVehicles();
    expect(after.some(v => v.id === '1')).toBe(false);
    expect(after).toHaveLength(2); // started with 3, deleted 1
  });

  test('returns false when trying to delete InUse', async () => {
    const service = await loadService();

    // id=2 is InUse
    const ok = service.deleteVehicle('2');
    expect(ok).toBe(false);

    const after = service.listVehicles();
    expect(after).toHaveLength(3); // unchanged
    expect(after.some(v => v.id === '2')).toBe(true);
  });

  test('returns false when trying to delete Maintenance', async () => {
    const service = await loadService();

    // id=3 is Maintenance
    const ok = service.deleteVehicle('3');
    expect(ok).toBe(false);

    const after = service.listVehicles();
    expect(after).toHaveLength(3); // unchanged
    expect(after.some(v => v.id === '3')).toBe(true);
  });

  test('returns false when id does not exist', async () => {
    const service = await loadService();

    const ok = service.deleteVehicle('NO_SUCH_ID');
    expect(ok).toBe(false);

    const after = service.listVehicles();
    expect(after).toHaveLength(3); // unchanged
  });

  test('persists to file after successful delete', async () => {
  // Seed has 3 vehicles; id=1 is Available
  seedVehiclesFile([
    { id: '1', licensePlate: '11AAA11', model: 'Model-A', status: 'Available',   createdAt: '2025-01-01T00:00:00.000Z' },
    { id: '2', licensePlate: '22BBB22', model: 'Model-B', status: 'InUse',       createdAt: '2025-01-02T00:00:00.000Z' },
    { id: '3', licensePlate: '33CCC33', model: 'Model-C', status: 'Maintenance', createdAt: '2025-01-03T00:00:00.000Z' }
  ]);
  const service = await loadService();

  const ok = service.deleteVehicle('1');
  expect(ok).toBe(true);

  // In-memory list updated
  const after = service.listVehicles();
  expect(after).toHaveLength(2);
  expect(after.some(v => v.id === '1')).toBe(false);

  // Persistence occurred with updated array of length 2
  expect(writeCalls.length).toBeGreaterThanOrEqual(1);
  const lastWrite = writeCalls[writeCalls.length - 1];
  const persisted = JSON.parse(lastWrite.data);
  expect(persisted).toHaveLength(2);
  expect(persisted.some((v: any) => v.id === '1')).toBe(false);
});

test('no write occurs when deleting InUse (not allowed)', async () => {
  // Reset to known seed
  seedVehiclesFile([
    { id: '1', licensePlate: '11AAA11', model: 'Model-A', status: 'Available',   createdAt: '2025-01-01T00:00:00.000Z' },
    { id: '2', licensePlate: '22BBB22', model: 'Model-B', status: 'InUse',       createdAt: '2025-01-02T00:00:00.000Z' },
    { id: '3', licensePlate: '33CCC33', model: 'Model-C', status: 'Maintenance', createdAt: '2025-01-03T00:00:00.000Z' }
  ]);
  const service = await loadService();

  const beforeWrites = writeCalls.length;
  const ok = service.deleteVehicle('2');
  expect(ok).toBe(false);

  // No change in memory
  const after = service.listVehicles();
  expect(after).toHaveLength(3);
  expect(after.some(v => v.id === '2')).toBe(true);

  // No persistence on failure
  expect(writeCalls.length).toBe(beforeWrites);
});

test('no write occurs when deleting Maintenance (not allowed)', async () => {
  // Reset to known seed
  seedVehiclesFile([
    { id: '1', licensePlate: '11AAA11', model: 'Model-A', status: 'Available',   createdAt: '2025-01-01T00:00:00.000Z' },
    { id: '2', licensePlate: '22BBB22', model: 'Model-B', status: 'InUse',       createdAt: '2025-01-02T00:00:00.000Z' },
    { id: '3', licensePlate: '33CCC33', model: 'Model-C', status: 'Maintenance', createdAt: '2025-01-03T00:00:00.000Z' }
  ]);
  const service = await loadService();

  const beforeWrites = writeCalls.length;
  const ok = service.deleteVehicle('3');
  expect(ok).toBe(false);

  const after = service.listVehicles();
  expect(after).toHaveLength(3);
  expect(after.some(v => v.id === '3')).toBe(true);

  // No persistence on failure
  expect(writeCalls.length).toBe(beforeWrites);
});

test('returns false and does not write when id does not exist', async () => {
  // Reset to known seed
  seedVehiclesFile([
    { id: '1', licensePlate: '11AAA11', model: 'Model-A', status: 'Available',   createdAt: '2025-01-01T00:00:00.000Z' },
    { id: '2', licensePlate: '22BBB22', model: 'Model-B', status: 'InUse',       createdAt: '2025-01-02T00:00:00.000Z' },
    { id: '3', licensePlate: '33CCC33', model: 'Model-C', status: 'Maintenance', createdAt: '2025-01-03T00:00:00.000Z' }
  ]);
  const service = await loadService();

  const beforeWrites = writeCalls.length;
  const ok = service.deleteVehicle('NO_SUCH_ID');
  expect(ok).toBe(false);

  const after = service.listVehicles();
  expect(after).toHaveLength(3);

  // No persistence on failure
  expect(writeCalls.length).toBe(beforeWrites);
});

});
