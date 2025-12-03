import { Router } from 'express';
import authorRoutes from './author.routes';
import reviseManuscriptRoutes from './reviseManuscript.routes';
import coAuthorRoutes from './coAuthor.routes';

const router = Router();

router.use('/author', authorRoutes);
router.use('/revise-manuscript', reviseManuscriptRoutes);
router.use('/co-author', coAuthorRoutes);

export default router;
