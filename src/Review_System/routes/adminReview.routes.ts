import { Router } from 'express';
import adminReviewController from '../controllers/adminReview.controller';
import {
  authenticateAdminToken,
  rateLimiter,
} from '../../middleware/auth.middleware';

const router = Router();

const adminReviewRateLimiter = rateLimiter(1000, 60 * 60 * 1000);

// Route to get all reviews assigned to the admin
router.get(
  '/reviews',
  authenticateAdminToken,
  adminReviewRateLimiter,
  adminReviewController.getAdminAssignments
);

// Route to get review statistics for the admin
router.get(
  '/reviews/statistics',
  authenticateAdminToken,
  adminReviewRateLimiter,
  adminReviewController.getAdminReviewerStatistics
);

// Route to get a single review by ID
router.get(
  '/reviews/:id',
  authenticateAdminToken,
  adminReviewRateLimiter,
  adminReviewController.getReviewById
);

// Route for an admin to submit a review
router.post(
  '/reviews/:id/submit',
  authenticateAdminToken,
  adminReviewRateLimiter,
  adminReviewController.submitReview
);

// Route for an admin to save review progress
router.patch(
  '/reviews/:id/save',
  authenticateAdminToken,
  adminReviewRateLimiter,
  adminReviewController.saveReviewProgress
);

router.get(
  '/:id/with-history',
  authenticateAdminToken,
  adminReviewRateLimiter,
  adminReviewController.getReviewWithHistory
);

router.get(
  '/:id/reconciliation-data',
  authenticateAdminToken,
  adminReviewRateLimiter,
  adminReviewController.getReconciliationData
);

export default router;
