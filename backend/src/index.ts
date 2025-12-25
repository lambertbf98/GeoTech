// @ts-nocheck
import express from 'express';
import cors from 'cors';
import path from 'path';
import fs from 'fs';
import { execSync } from 'child_process';
import { config } from './config';
import { errorHandler } from './middleware/errorHandler';
import authRoutes from './routes/auth.routes';
import projectRoutes from './routes/project.routes';
import photoRoutes from './routes/photo.routes';
import catastroRoutes from './routes/catastro.routes';
import claudeRoutes from './routes/claude.routes';
import exportRoutes from './routes/export.routes';
import syncRoutes from './routes/sync.routes';

// Run database migrations on startup
try {
  console.log('Running database migrations...');
  execSync('npx prisma db push --skip-generate', { stdio: 'inherit' });
  console.log('Database migrations completed');
} catch (error) {
  console.error('Database migration failed:', error);
}

const app = express();

// Simple root health check (before any middleware)
app.get('/', (req, res) => {
  res.send('GeoTech API is running');
});
app.get('/health', (req, res) => {
  res.json({ status: 'ok' });
});

// Crear directorio de uploads si no existe
const uploadDir = path.resolve(config.upload.dir);
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

// Middleware - CORS configuration for all origins
app.use(cors({
  origin: '*',
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
  credentials: false
}));
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// Servir archivos estaticos de uploads
app.use('/uploads', express.static(uploadDir));

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/projects', projectRoutes);
app.use('/api/photos', photoRoutes);
app.use('/api/catastro', catastroRoutes);
app.use('/api/claude', claudeRoutes);
app.use('/api/export', exportRoutes);
app.use('/api/sync', syncRoutes);

// Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Error handler
app.use(errorHandler);

// Start server - bind to 0.0.0.0 for Railway/Docker compatibility
const HOST = '0.0.0.0';
app.listen(config.port, HOST, () => {
  console.log("GeoTech API running on " + HOST + ":" + config.port);
  console.log("Environment: " + config.nodeEnv);
});

export default app;
