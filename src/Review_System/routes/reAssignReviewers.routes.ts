import { Router } from 'express';
import reassignReviewController from '../controllers/reAssignReviewer.controller';
import { authenticateAdminToken } from '../../middleware/auth.middleware';
import validateRequest from '../../middleware/validateRequest';
import { z } from 'zod';

const router = Router();

const reassignSchema = z.object({
  params: z.object({
    reviewId: z.string().regex(/^[0-9a-fA-F]{24}$/, 'Invalid review ID format'),
  }),
  body: z.object({
    assignmentType: z.enum(['automatic', 'manual']),
    newReviewerId: z
      .string()
      .regex(/^[0-9a-fA-F]{24}$/, 'Invalid reviewer ID format')
      .optional(),
  }),
});

const manuscriptIdSchema = z.object({
  params: z.object({
    manuscriptId: z
      .string()
      .regex(/^[0-9a-fA-F]{24}$/, 'Invalid manuscript ID format'),
  }),
});

router.put(
  '/:reviewId',
  authenticateAdminToken,
  validateRequest(reassignSchema),
  reassignReviewController.reassignReview
);

router.get(
  '/eligible-reviewers/:manuscriptId',
  authenticateAdminToken,
  validateRequest(manuscriptIdSchema),
  reassignReviewController.getEligibleReviewers
);

router.get(
  '/existing-reviewers/:manuscriptId',
  authenticateAdminToken,
  validateRequest(manuscriptIdSchema),
  reassignReviewController.getExistingReviewers
);

router.get(
  '/eligible-reviewers-revised/:manuscriptId',
  authenticateAdminToken,
  validateRequest(manuscriptIdSchema),
  reassignReviewController.getEligibleReviewersForRevised
);

export default router;
