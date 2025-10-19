import { Router } from 'express';
import authorRoutes from './author.routes';
import reviseManuscriptRoutes from './reviseManuscript.routes';

const router = Router();

router.use('/author', authorRoutes);
router.use('/', reviseManuscriptRoutes);

export default router;
