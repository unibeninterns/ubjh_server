import { Router } from 'express';
import submitRoutes from '../Manuscript_Submission/routes/submitManuscript.routes';
import adminRoutes from './admin.routes';
import authRoutes from './auth.routes';
import authorRoutes from '../authors/routes/index';
import reviewerRoutes from '../Reviewers/routes/reviewer.routes';
import reviewSystemRoutes from '../Review_System/routes/review.routes';
import publicationRoutes from '../Publication/routes/publication.routes';
import overrideDecisionRoutes from './overrideDecision.routes';

const router = Router();

// Mount route groups
router.use('/submit', submitRoutes);
router.use('/admin', adminRoutes);
router.use('/auth', authRoutes);
router.use('/', authorRoutes);
router.use('/reviewer', reviewerRoutes);
router.use('/reviewsys', reviewSystemRoutes);
router.use('/publication', publicationRoutes);
router.use('/admin/override-decision', overrideDecisionRoutes);

// Root route
router.get('/', (req, res) => {
  res.json({
    success: true,
    message: 'UNIBEN Journal for Humanities API is running',
  });
});

export default router;
