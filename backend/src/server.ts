import express from 'express';
import cors from 'cors';
import vehiclesRouter from './routes (APIs)/vehicles';

const app = express();

// Middlewares
app.use(cors());
app.use(express.json());

// Routes
app.use('/api/vehicles', vehiclesRouter);

// Healthcheck
app.get('/health', (_req, res) => res.json({ ok: true }));

// Boot
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  // eslint-disable-next-line no-console
  console.log(`API listening on http://localhost:${PORT}`);
});
