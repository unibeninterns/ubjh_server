import { Router } from 'express';
import reviewController from '../controllers/review.controller';
import {
  authenticateReviewerToken,
  rateLimiter,
} from '../../middleware/auth.middleware';
import validateRequest from '../../middleware/validateRequest';
import { z } from 'zod';
import { ReviewDecision } from '../../Manuscript_Submission/models/manuscript.model';

const router = Router();

const reviewerRateLimiter = rateLimiter(1000, 60 * 60 * 1000);
router.use(reviewerRateLimiter);

const reviewIdSchema = z.object({
  params: z.object({
    id: z.string().regex(/^[0-9a-fA-F]{24}$/, 'Invalid review ID format'),
  }),
});

const scoresSchema = z.object({
  originality: z.number().min(0).max(20),
  methodology: z.number().min(0).max(20),
  clarity: z.number().min(0).max(15),
  relevance: z.number().min(0).max(15),
  literature: z.number().min(0).max(10),
  results: z.number().min(0).max(10),
  contribution: z.number().min(0).max(10),
});

const submitReviewSchema = z.object({
  params: z.object({
    id: z.string().regex(/^[0-9a-fA-F]{24}$/, 'Invalid review ID format'),
  }),
  body: z.object({
    scores: scoresSchema,
    comments: z.object({
      commentsForAuthor: z.string().optional(),
      confidentialCommentsToEditor: z.string().optional(),
    }),
    reviewDecision: z.nativeEnum(ReviewDecision),
  }),
});

const saveProgressSchema = z.object({
  params: z.object({
    id: z.string().regex(/^[0-9a-fA-F]{24}$/, 'Invalid review ID format'),
  }),
  body: z.object({
    scores: scoresSchema.partial().optional(),
    comments: z
      .object({
        commentsForAuthor: z.string().optional(),
        confidentialCommentsToEditor: z.string().optional(),
      })
      .optional(),
    reviewDecision: z.nativeEnum(ReviewDecision).optional(),
  }),
});

router.get(
  '/assignments',
  authenticateReviewerToken,
  reviewController.getReviewerAssignments
);

router.get(
  '/statistics',
  authenticateReviewerToken,
  reviewController.getReviewerStatistics
);

router.get(
  '/:id',
  authenticateReviewerToken,
  validateRequest(reviewIdSchema),
  reviewController.getReviewById
);

router.post(
  '/:id/submit',
  authenticateReviewerToken,
  validateRequest(submitReviewSchema),
  reviewController.submitReview
);

router.patch(
  '/:id/save-progress',
  authenticateReviewerToken,
  validateRequest(saveProgressSchema),
  reviewController.saveReviewProgress
);

router.get(
  '/:id/with-history',
  authenticateReviewerToken,
  validateRequest(reviewIdSchema),
  reviewController.getReviewWithHistory
);

router.get(
  '/:id/reconciliation-data',
  authenticateReviewerToken,
  validateRequest(reviewIdSchema),
  reviewController.getReconciliationData
);

export default router;
