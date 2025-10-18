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

class AdminReviewController {
  // Method to get all reviews assigned to the admin
  getAdminAssignments = asyncHandler(
    async (req: Request, res: Response<IReviewResponse>): Promise<void> => {
      const user = (req as AuthenticatedRequest).user;
      const adminId = user.id;

      const reviews = await Review.find({ reviewer: adminId })
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

  // Method to get a single review by ID, ensuring it's assigned to the admin
  getReviewById = asyncHandler(
    async (req: Request, res: Response<IReviewResponse>): Promise<void> => {
      const user = (req as AuthenticatedRequest).user;
      const { id } = req.params;
      const adminId = user.id;

      const review = await Review.findOne({
        _id: id,
        reviewer: adminId,
      }).populate({
        path: 'manuscript',
        select: 'title abstract keywords',
      });

      if (!review) {
        throw new NotFoundError('Review not found or not assigned to this admin');
      }

      res.status(200).json({
        success: true,
        data: review,
      });
    }
  );

  // Method for admin to submit a completed review
  submitReview = asyncHandler(
    async (
      req: Request,
      res: Response<IReviewResponse>,
      next: NextFunction
    ): Promise<void> => {
      const user = (req as AuthenticatedRequest).user;
      const { id } = req.params;
      const adminId = user.id;
      const { reviewDecision, comments, scores } = req.body;

      const review = await Review.findOne({
        _id: id,
        reviewer: adminId,
        status: { $ne: ReviewStatus.COMPLETED },
      });

      if (!review) {
        throw new NotFoundError(
          'Review not found, not assigned to admin, or already completed'
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
        reconciliationController.handleDiscrepancy(req, res, next);
      } else {
        res.status(200).json({
          success: true,
          message: 'Review submitted successfully by admin',
          data: review,
        });
      }
    }
  );

  // Method for admin to save review progress
  saveReviewProgress = asyncHandler(
    async (req: Request, res: Response<IReviewResponse>): Promise<void> => {
      const user = (req as AuthenticatedRequest).user;
      const { id } = req.params;
      const adminId = user.id;
      const { reviewDecision, comments, scores } = req.body;

      const review = await Review.findOne({
        _id: id,
        reviewer: adminId,
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
        message: 'Admin review progress saved',
        data: review,
      });
    }
  );

  // Method to get review statistics for the admin
  getAdminReviewerStatistics = asyncHandler(
    async (req: Request, res: Response<IReviewResponse>): Promise<void> => {
      const user = (req as AuthenticatedRequest).user;
      const adminId = user.id;

      const [totalAssigned, completed, pending, overdue] = await Promise.all([
        Review.countDocuments({ reviewer: adminId }),
        Review.countDocuments({
          reviewer: adminId,
          status: ReviewStatus.COMPLETED,
        }),
        Review.countDocuments({
          reviewer: adminId,
          status: ReviewStatus.IN_PROGRESS,
          dueDate: { $gt: new Date() },
        }),
        Review.countDocuments({
          reviewer: adminId,
          status: ReviewStatus.IN_PROGRESS,
          dueDate: { $lte: new Date() },
        }),
      ]);

      const recentActivity = await Review.find({ reviewer: adminId })
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

export default new AdminReviewController();
