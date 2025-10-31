import { Router } from 'express';
import articleAnalyticsController from '../controllers/articleAnalytics.controller';
import { rateLimiter } from '../../middleware/auth.middleware';

const router = Router();

const publicRateLimiter = rateLimiter(10000, 60 * 60 * 1000); // 10000 requests per hour

// Public routes for tracking
router.post(
  '/:id/view',
  publicRateLimiter,
  articleAnalyticsController.recordView
);

router.post(
  '/:id/download',
  publicRateLimiter,
  articleAnalyticsController.recordDownload
);

// Public route for popular articles
router.get(
  '/popular',
  publicRateLimiter,
  articleAnalyticsController.getPopularArticles
);

// Protected route for detailed analytics (author/admin only)
router.get(
  '/:id/analytics',
  publicRateLimiter,
  articleAnalyticsController.getArticleAnalytics
);

export default router;
