import express, { type Express, type Request, type Response } from 'express';
import cors from 'cors';
import * as dotenv from 'dotenv';
import fairRoutes from './routes/fairRoutes';

dotenv.config();

const app: Express = express();
const port = process.env.PORT || 3001;
const defaultCorsOrigins = [
  'https://www.ieventsplus.tech',
  'https://ieventsplus.tech',
  'https://ferias-virtuales.vercel.app',
];
const corsOrigins = [
  ...defaultCorsOrigins,
  ...(process.env.CORS_ORIGINS || '').split(','),
]
  .map((origin) => origin.trim())
  .filter(Boolean);
const allowedCorsOrigins = new Set(corsOrigins);

// Middleware
app.use(cors({
  origin: (origin, callback) => {
    if (!origin || allowedCorsOrigins.has(origin)) {
      callback(null, true);
      return;
    }

    callback(new Error(`CORS origin not allowed: ${origin}`));
  },
  credentials: true,
}));
app.use(express.json());

// Routes
app.use('/api', fairRoutes);

app.get('/health', (req: Request, res: Response) => {
  res.json({
    ok: true,
    service: 'virtual-fair-api',
    timestamp: new Date().toISOString(),
  });
});

// Error handling
app.use((err: any, req: Request, res: Response, next: any) => {
  console.error(err.stack);
  res.status(500).send('Something went wrong!');
});

app.listen(port, () => {
  console.log(`[server]: Server is running at http://localhost:${port}`);
});
