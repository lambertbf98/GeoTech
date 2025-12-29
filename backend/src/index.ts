// @ts-nocheck
import express from 'express';
import cors from 'cors';
import path from 'path';
import fs from 'fs';
import { exec } from 'child_process';
import { config } from './config';
import { errorHandler } from './middleware/errorHandler';
import authRoutes from './routes/auth.routes';
import projectRoutes from './routes/project.routes';
import photoRoutes from './routes/photo.routes';
import catastroRoutes from './routes/catastro.routes';
import claudeRoutes from './routes/claude.routes';
import exportRoutes from './routes/export.routes';
import syncRoutes from './routes/sync.routes';
import reportRoutes from './routes/report.routes';

const app = express();

// Health check endpoint (for Railway)
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
app.use('/api/reports', reportRoutes);

// Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Serve frontend static files
const frontendPath = path.join(__dirname, '..', 'public');
if (fs.existsSync(frontendPath)) {
  app.use(express.static(frontendPath));

  // SPA fallback - serve index.html for all non-API routes
  app.get('*', (req, res, next) => {
    if (req.path.startsWith('/api/') || req.path.startsWith('/uploads/')) {
      return next();
    }
    res.sendFile(path.join(frontendPath, 'index.html'));
  });
}

// Error handler
app.use(errorHandler);

// Start server FIRST - bind to 0.0.0.0 for Railway/Docker compatibility
const HOST = '0.0.0.0';
const port = process.env.PORT || 3000;

const server = app.listen(port, HOST, () => {
  console.log('GeoTech API running on ' + HOST + ':' + port);
  console.log('Environment: ' + config.nodeEnv);

  // Run database migrations AFTER server starts (async, non-blocking)
  console.log('Running database migrations...');
  exec('npx prisma db push --skip-generate', (error, stdout, stderr) => {
    if (error) {
      console.error('Database migration failed:', error.message);
      return;
    }
    if (stderr) {
      console.log('Migration output:', stderr);
    }
    console.log('Database migrations completed');
  });
});

export default app;
