import { Request, Response, NextFunction } from 'express';
import Review, { ReviewStatus, ReviewType } from '../models/review.model';
import { NotFoundError } from '../../utils/customErrors';
import asyncHandler from '../../utils/asyncHandler';
import reconciliationController from './reconciliation.controller';

interface IReviewResponse {
  success: boolean;
  count?: number;
  message?: string;
  data?: any;
}

interface AuthenticatedRequest extends Request {
  user: {
    id: string;
    role: string;
  };
}

class ReviewController {
  getReviewerAssignments = asyncHandler(
    async (req: Request, res: Response<IReviewResponse>): Promise<void> => {
      const user = (req as AuthenticatedRequest).user;
      const reviewerId = user.id;

      const reviews = await Review.find({ reviewer: reviewerId })
        .populate({
          path: 'manuscript',
          select: 'title status createdAt',
        })
        .sort({ dueDate: 1 });

      res.status(200).json({
        success: true,
        count: reviews.length,
        data: reviews,
      });
    }
  );

  getReviewById = asyncHandler(
    async (req: Request, res: Response<IReviewResponse>): Promise<void> => {
      const user = (req as AuthenticatedRequest).user;
      const { id } = req.params;
      const reviewerId = user.id;

      const review = await Review.findOne({
        _id: id,
        reviewer: reviewerId,
      }).populate({
        path: 'manuscript',
        select: 'title abstract keywords pdfFile',
      });

      if (!review) {
        throw new NotFoundError('Review not found or unauthorized');
      }

      res.status(200).json({
        success: true,
        data: review,
      });
    }
  );

  submitReview = asyncHandler(
    async (
      req: Request,
      res: Response<IReviewResponse>,
      next: NextFunction
    ): Promise<void> => {
      const user = (req as AuthenticatedRequest).user;
      const { id } = req.params;
      const reviewerId = user.id;
      const { reviewDecision, comments, scores } = req.body;

      const review = await Review.findOne({
        _id: id,
        reviewer: reviewerId,
        status: { $ne: ReviewStatus.COMPLETED },
      });

      if (!review) {
        throw new NotFoundError(
          'Review not found, unauthorized, or already completed'
        );
      }

      review.reviewDecision = reviewDecision;
      review.comments = comments;
      review.scores = scores;
      review.status = ReviewStatus.COMPLETED;
      review.completedAt = new Date();

      await review.save();

      // Check for discrepancy if this is the second human review
      const humanReviews = await Review.find({
        manuscript: review.manuscript,
        reviewType: ReviewType.HUMAN,
        status: ReviewStatus.COMPLETED,
      });

      if (humanReviews.length === 2) {
        req.params.manuscriptId = review.manuscript.toString();
        await reconciliationController.handleDiscrepancy(req, res, next);
      } else {
        res.status(200).json({
          success: true,
          message: 'Review submitted successfully',
          data: review,
        });
      }
    }
  );

  saveReviewProgress = asyncHandler(
    async (req: Request, res: Response<IReviewResponse>): Promise<void> => {
      const user = (req as AuthenticatedRequest).user;
      const { id } = req.params;
      const reviewerId = user.id;
      const { reviewDecision, comments, scores } = req.body;

      const review = await Review.findOne({
        _id: id,
        reviewer: reviewerId,
        status: ReviewStatus.IN_PROGRESS,
      });

      if (!review) {
        throw new NotFoundError('Review not found or cannot be updated');
      }

      if (reviewDecision) {
        review.reviewDecision = reviewDecision;
      }

      if (comments) {
        review.comments = { ...review.comments, ...comments };
      }

      if (scores) {
        review.scores = { ...review.scores, ...scores };
      }

      await review.save();

      res.status(200).json({
        success: true,
        message: 'Review progress saved',
        data: review,
      });
    }
  );

  getReviewerStatistics = asyncHandler(
    async (req: Request, res: Response<IReviewResponse>): Promise<void> => {
      const user = (req as AuthenticatedRequest).user;
      const reviewerId = user.id;

      const [totalAssigned, completed, pending, overdue] = await Promise.all([
        Review.countDocuments({ reviewer: reviewerId }),
        Review.countDocuments({
          reviewer: reviewerId,
          status: ReviewStatus.COMPLETED,
        }),
        Review.countDocuments({
          reviewer: reviewerId,
          status: ReviewStatus.IN_PROGRESS,
          dueDate: { $gt: new Date() },
        }),
        Review.countDocuments({
          reviewer: reviewerId,
          status: ReviewStatus.IN_PROGRESS,
          dueDate: { $lte: new Date() },
        }),
      ]);

      const recentActivity = await Review.find({ reviewer: reviewerId })
        .sort({ updatedAt: -1 })
        .limit(5)
        .populate('manuscript', 'title');

      res.status(200).json({
        success: true,
        data: {
          statistics: {
            totalAssigned,
            completed,
            pending,
            overdue,
          },
          recentActivity,
        },
      });
    }
  );
}

export default new ReviewController();
