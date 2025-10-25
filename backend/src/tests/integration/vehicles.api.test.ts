// backend/src/tests/integration/vehicles.api.test.ts
import fs from 'fs'
import path from 'path'
import os from 'os'
import express from 'express'
import request from 'supertest'

// Utility: build a temporary Express app for isolated integration tests
function buildAppWithTempData() {
  // 1) Create a temporary directory for test data
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'vehicles-'))

  // 2) Copy the seed file into the temp folder
  const seedSrc = path.join(__dirname, '../../data/vehicles.json')
  const seedDst = path.join(tmpDir, 'vehicles.json')
  fs.copyFileSync(seedSrc, seedDst)

  // 3) Point the service to this temporary file
  process.env.DATA_PATH = seedDst
  process.env.ADMIN_DELETE_TOKEN = 'test-admin-token'

  // 4) Reset modules so the service reloads with the new DATA_PATH
  jest.resetModules()
  const vehiclesRouter = require('../../routes (APIs)/vehicles').default

  // 5) Build a lightweight Express app using the router
  const app = express()
  app.use(express.json())
  app.use('/api/vehicles', vehiclesRouter)

  return { app, tmpDir }
}

let app: express.Express
let tmpDir: string

beforeEach(() => {
  const built = buildAppWithTempData()
  app = built.app
  tmpDir = built.tmpDir
})

afterEach(() => {
  // Clean up temp folder (best effort)
  try { fs.rmSync(tmpDir, { recursive: true, force: true }) } catch {}
})

// --- helper functions ---
// Generates a plate of 5–10 valid characters (letters + digits), may include a dash
function uniqPlate(): string {
  const letters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'
  const digits = '0123456789'

  // base: 2–4 letters + 3–6 digits = 5–10 chars total after normalization
  const part1 = Array.from({ length: Math.floor(Math.random() * 3) + 2 })
    .map(() => letters[Math.floor(Math.random() * letters.length)])
    .join('')

  const part2 = Array.from({ length: Math.floor(Math.random() * 4) + 3 })
    .map(() => digits[Math.floor(Math.random() * digits.length)])
    .join('')

  return `${part1}-${part2}`
}


async function createVehicle(app: express.Express, plate = uniqPlate(), model = 'TEST') {
  const res = await request(app)
    .post('/api/vehicles')
    .send({ licensePlate: plate, model })
  expect(res.status).toBe(201)
  return res.body as { id: string; licensePlate: string; model: string; status: string; createdAt: string }
}

// --- TESTS START ---

describe('GET /api/vehicles', () => {
  it('returns 200 and an array', async () => {
    const res = await request(app).get('/api/vehicles')
    expect(res.status).toBe(200)
    expect(Array.isArray(res.body)).toBe(true)
  })
})

describe('POST /api/vehicles', () => {
  it('creates a vehicle with default status Available', async () => {
    const plate = uniqPlate()
    const res = await request(app)
      .post('/api/vehicles')
      .send({ licensePlate: plate, model: 'TOYOTA' })

    expect(res.status).toBe(201)
    expect(res.body.status).toBe('Available')
  })
})

// --- EDIT STATUS TESTS ---
describe('PATCH /api/vehicles/:licensePlate/status', () => {
  it('allows legal transition: Available -> InUse', async () => {
    const v = await createVehicle(app, uniqPlate(), 'MAZDA')
    const res = await request(app)
      .patch(`/api/vehicles/${v.licensePlate}/status`)
      .send({ status: 'InUse' })

    expect(res.status).toBe(200)
    expect(res.body.status).toBe('InUse')
  })

  it('blocks Maintenance -> InUse (illegal transition)', async () => {
    // We prefer using an already-in-Maintenance vehicle from the seed to avoid cap issues.
    const list = await request(app).get('/api/vehicles')
    expect(list.status).toBe(200)
    const fleet = list.body as Array<{ licensePlate: string; status: string }>
    let target = fleet.find(v => v.status === 'Maintenance')

    // If none exists, create one and try to move it into Maintenance (cap allows at least 1).
    if (!target) {
      const created = await createVehicle(app, uniqPlate(), 'HONDA')
      const m1 = await request(app)
        .patch(`/api/vehicles/${created.licensePlate}/status`)
        .send({ status: 'Maintenance' })

      // If cap is already full (rare), re-pull and pick any Maintenance vehicle from the fleet.
      if (m1.status === 200) {
        target = m1.body
      } else {
        const refresh = await request(app).get('/api/vehicles')
        const refreshedFleet = refresh.body as Array<{ licensePlate: string; status: string }>
        target = refreshedFleet.find(v => v.status === 'Maintenance')
      }
    }

    // At this point, 'target' must be in Maintenance. Attempt Maintenance -> InUse (illegal).
    expect(target).toBeDefined()
    const res = await request(app)
      .patch(`/api/vehicles/${target!.licensePlate}/status`)
      .send({ status: 'InUse' })

    expect(res.status).toBe(409)
    expect(res.body?.error?.code).toBe('ILLEGAL_STATUS_TRANSITION')
  })

  it('enforces the 5% Maintenance cap', async () => {
    // Read current fleet to compute the real-time cap and current Maintenance load.
    const list = await request(app).get('/api/vehicles')
    expect(list.status).toBe(200)
    const fleet = list.body as Array<{ licensePlate: string; status: string }>

    const total = fleet.length
    const cap = Math.max(1, Math.floor(total * 0.05))
    const currentMaintenance = fleet.filter(v => v.status === 'Maintenance').length
    const remaining = Math.max(0, cap - currentMaintenance)

    // If there is room, fill up to the cap with newly created vehicles moved into Maintenance.
    for (let i = 0; i < remaining; i++) {
      const v = await createVehicle(app, uniqPlate(), 'FORD')
      const r = await request(app)
        .patch(`/api/vehicles/${v.licensePlate}/status`)
        .send({ status: 'Maintenance' })
      expect(r.status).toBe(200)
      expect(r.body.status).toBe('Maintenance')
    }

    // Now the cap should be full — the next attempt must be blocked with 409.
    const extra = await createVehicle(app, uniqPlate(), 'FORD')
    const blocked = await request(app)
      .patch(`/api/vehicles/${extra.licensePlate}/status`)
      .send({ status: 'Maintenance' })

    expect(blocked.status).toBe(409)
    expect(blocked.body?.error?.code).toBe('MAINTENANCE_CAP_EXCEEDED')
  })
})

// --- EDIT PLATE TESTS ---
describe('PATCH /api/vehicles/:id/plate', () => {
  it('updates license plate successfully', async () => {
    const v = await createVehicle(app, uniqPlate(), 'BMW')
    const nextPlate = uniqPlate()

    const res = await request(app)
      .patch(`/api/vehicles/${v.id}/plate`)
      .send({ licensePlate: nextPlate })

    expect(res.status).toBe(200)
    expect(res.body.licensePlate).toBeDefined()
  })

  it('fails on duplicate license plate', async () => {
    const v1 = await createVehicle(app, uniqPlate(), 'KIA')
    const v2 = await createVehicle(app, uniqPlate(), 'KIA')

    const res = await request(app)
      .patch(`/api/vehicles/${v2.id}/plate`)
      .send({ licensePlate: v1.licensePlate })

    expect(res.status).toBe(409)
    expect(res.body?.error?.code).toBe('DUPLICATE_LICENSE_PLATE')
  })
})

// --- DELETE TESTS ---
describe('DELETE /api/vehicles/:id', () => {
  // ADMIN token is set in buildAppWithTempData via process.env.ADMIN_DELETE_TOKEN
  const ADMIN = 'test-admin-token'

  it('returns 403 without admin token', async () => {
    const v = await createVehicle(app, uniqPlate(), 'NISSAN')
    const res = await request(app).delete(`/api/vehicles/${v.id}`)
    expect(res.status).toBe(403)
    expect(res.body?.error?.code).toBe('ADMIN_APPROVAL_REQUIRED')
  })

  it('returns 403 with wrong admin token', async () => {
    const v = await createVehicle(app, uniqPlate(), 'NISSAN')
    const res = await request(app)
      .delete(`/api/vehicles/${v.id}`)
      .set('x-admin-token', 'wrong-token')
    expect(res.status).toBe(403)
    expect(res.body?.error?.code).toBe('ADMIN_APPROVAL_REQUIRED')
  })

  it('deletes when Available and token correct', async () => {
    const v = await createVehicle(app, uniqPlate(), 'NISSAN')
    const res = await request(app)
      .delete(`/api/vehicles/${v.id}`)
      .set('x-admin-token', ADMIN)
    expect(res.status).toBe(200)
  })

  it('blocks delete when vehicle InUse (409)', async () => {
    const v = await createVehicle(app, uniqPlate(), 'NISSAN')

    // Move to InUse first
    const p = await request(app)
      .patch(`/api/vehicles/${v.licensePlate}/status`)
      .send({ status: 'InUse' })
    expect(p.status).toBe(200)

    const res = await request(app)
      .delete(`/api/vehicles/${v.id}`)
      .set('x-admin-token', ADMIN)
    expect(res.status).toBe(409)
    expect(res.body?.error?.code).toBe('NOT_ALLOWED_STATUS_FOR_DELETE')
  })
})
