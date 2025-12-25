import { Router, Response, NextFunction } from 'express';
import { body, validationResult } from 'express-validator';
import { authenticate, AuthRequest } from '../middleware/auth';
import { projectService } from '../services/project.service';
import { photoService } from '../services/photo.service';

const router = Router();

router.use(authenticate);

interface SyncItem {
  id: string;
  action: 'CREATE' | 'UPDATE' | 'DELETE';
  entity: 'project' | 'photo';
  data: any;
  timestamp: string;
}

interface SyncResult {
  localId: string;
  serverId?: string;
  status: 'success' | 'conflict' | 'error';
  error?: string;
  serverVersion?: any;
}

// POST /api/sync/batch
router.post(
  '/batch',
  [
    body('items').isArray().withMessage('items debe ser un array')
  ],
  async (req: AuthRequest, res: Response, next: NextFunction) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        error: {
          code: 'VALIDATION_ERROR',
          message: errors.array()[0].msg
        }
      });
    }

    try {
      const { items } = req.body as { items: SyncItem[] };
      const results: SyncResult[] = [];

      for (const item of items) {
        try {
          const result = await processSyncItem(req.userId!, item);
          results.push(result);
        } catch (error) {
          results.push({
            localId: item.id,
            status: 'error',
            error: error instanceof Error ? error.message : 'Error desconocido'
          });
        }
      }

      res.json({ results });
    } catch (error) {
      next(error);
    }
  }
);

async function processSyncItem(userId: string, item: SyncItem): Promise<SyncResult> {
  switch (item.entity) {
    case 'project':
      return processProjectSync(userId, item);
    case 'photo':
      return processPhotoSync(userId, item);
    default:
      return {
        localId: item.id,
        status: 'error',
        error: `Entidad desconocida: ${item.entity}`
      };
  }
}

async function processProjectSync(userId: string, item: SyncItem): Promise<SyncResult> {
  switch (item.action) {
    case 'CREATE': {
      const project = await projectService.create(userId, item.data.name, item.data.description);
      return {
        localId: item.id,
        serverId: project.id,
        status: 'success'
      };
    }
    case 'UPDATE': {
      await projectService.update(userId, item.data.id, {
        name: item.data.name,
        description: item.data.description
      });
      return {
        localId: item.id,
        serverId: item.data.id,
        status: 'success'
      };
    }
    case 'DELETE': {
      await projectService.delete(userId, item.data.id);
      return {
        localId: item.id,
        status: 'success'
      };
    }
    default:
      return {
        localId: item.id,
        status: 'error',
        error: `Acción desconocida: ${item.action}`
      };
  }
}

async function processPhotoSync(userId: string, item: SyncItem): Promise<SyncResult> {
  switch (item.action) {
    case 'UPDATE': {
      await photoService.update(userId, item.data.id, {
        notes: item.data.notes
      });
      return {
        localId: item.id,
        serverId: item.data.id,
        status: 'success'
      };
    }
    case 'DELETE': {
      await photoService.delete(userId, item.data.id);
      return {
        localId: item.id,
        status: 'success'
      };
    }
    default:
      // CREATE de fotos se maneja por separado con multipart/form-data
      return {
        localId: item.id,
        status: 'error',
        error: 'Para crear fotos use el endpoint POST /api/photos'
      };
  }
}

export default router;
