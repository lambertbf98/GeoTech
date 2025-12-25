// @ts-nocheck
import { Router, Response, NextFunction } from 'express';
import { body, validationResult } from 'express-validator';
import { authenticate, AuthRequest } from '../middleware/auth';
import { projectService } from '../services/project.service';

const router = Router();

// Todas las rutas requieren autenticación
router.use(authenticate);

// GET /api/projects
router.get('/', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const projects = await projectService.getAll(req.userId!);
    res.json({ projects });
  } catch (error) {
    next(error);
  }
});

// GET /api/projects/:id
router.get('/:id', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const project = await projectService.getById(req.userId!, req.params.id);
    res.json({ project });
  } catch (error) {
    next(error);
  }
});

// POST /api/projects
router.post(
  '/',
  [
    body('name').notEmpty().withMessage('El nombre es requerido')
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
      const { name, description } = req.body;
      const project = await projectService.create(req.userId!, name, description);
      res.status(201).json({ project });
    } catch (error) {
      next(error);
    }
  }
);

// PUT /api/projects/:id
router.put('/:id', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { name, description } = req.body;
    const project = await projectService.update(req.userId!, req.params.id, { name, description });
    res.json({ project });
  } catch (error) {
    next(error);
  }
});

// DELETE /api/projects/:id
router.delete('/:id', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    await projectService.delete(req.userId!, req.params.id);
    res.status(204).send();
  } catch (error) {
    next(error);
  }
});

export default router;
