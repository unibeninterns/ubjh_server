/* eslint-disable max-lines */
import { Request, Response } from 'express';
import User, { UserRole, IUser } from '../../model/user.model';
import Manuscript, {
  IManuscript,
  ManuscriptStatus,
} from '../../Manuscript_Submission/models/manuscript.model';
import Review, {
  ReviewStatus,
  ReviewType,
  IReview,
} from '../models/review.model';
import asyncHandler from '../../utils/asyncHandler';
import logger from '../../utils/logger';
import emailService from '../../services/email.service';
import { NotFoundError, BadRequestError } from '../../utils/customErrors';
import { Types } from 'mongoose';
import { getEligibleFaculties } from '../../utils/facultyClusters';

interface IAssignReviewResponse {
  success: boolean;
  message?: string;
  data?: any;
}

// Define interface for reviewers with aggregated counts
interface IReviewerWithCounts extends IUser {
  pendingReviewsCount: number;
  discrepancyCount: number;
  totalReviewsCount: number;
}

// Define interface for populated review
interface PopulatedReview extends Omit<IReview, 'manuscript' | 'reviewer'> {
  reviewer?: {
    email: string;
    name: string;
    _id?: Types.ObjectId;
  };
  manuscript?: {
    title: string;
    _id?: Types.ObjectId;
  };
  dueDate: Date;
  _id: Types.ObjectId;
  status: ReviewStatus;
  save(): Promise<IReview>;
}

class AssignReviewController {
  assignReviewer = asyncHandler(
    async (
      req: Request<{ manuscriptId: string }, {}, { assignmentType: 'automatic' | 'manual', reviewerId?: string }>,
      res: Response<IAssignReviewResponse>
    ): Promise<void> => {
      const { manuscriptId } = req.params;
      const { assignmentType, reviewerId } = req.body;

      const manuscript = await Manuscript.findById(manuscriptId).populate({
        path: 'submitter',
        select: 'name assignedFaculty',
      });

      if (!manuscript) {
        throw new NotFoundError('Manuscript not found');
      }

      const existingReviews = await Review.find({ manuscript: manuscriptId });
      if (existingReviews.length >= 2) {
        throw new BadRequestError('Manuscript already has two reviewers.');
      }

      let selectedReviewer: IUser | IReviewerWithCounts | null = null;

      if (assignmentType === 'manual') {
        if (!reviewerId) {
          throw new BadRequestError('Reviewer ID is required for manual assignment.');
        }
        selectedReviewer = await User.findById(reviewerId);
        if (!selectedReviewer) {
          throw new NotFoundError('Selected reviewer not found.');
        }
        const selectedReviewerId: Types.ObjectId = selectedReviewer!._id as Types.ObjectId;
        if (existingReviews.some(r => r.reviewer.equals(selectedReviewerId))) {
            throw new BadRequestError('This reviewer is already assigned to this manuscript.');
        }

      } else { // Automatic assignment
        const submitter = manuscript.submitter as any;
        const submitterFaculty = submitter.assignedFaculty;

        if (!submitterFaculty) {
          throw new BadRequestError('Cannot assign reviewers: Submitter has no assigned faculty.');
        }

        const eligibleFaculties = getEligibleFaculties(submitterFaculty);
        if (eligibleFaculties.length === 0) {
            throw new BadRequestError("Cannot assign reviewers: No eligible faculties found for the manuscript's cluster");
        }

        const existingReviewerIds = existingReviews.map(r => r.reviewer);

        const eligibleReviewers = await User.aggregate<IReviewerWithCounts>([
          {
            $match: {
              assignedFaculty: { $in: eligibleFaculties },
              role: UserRole.REVIEWER, // No admins in automatic assignment
              isActive: true,
              invitationStatus: { $in: ['accepted', 'added'] },
              _id: { $nin: existingReviewerIds }
            },
          },
          {
            $lookup: {
              from: 'Reviews',
              localField: '_id',
              foreignField: 'reviewer',
              as: 'allReviews',
            },
          },
          {
            $addFields: {
              totalReviewsCount: { $size: '$allReviews' },
              pendingReviewsCount: {
                $size: {
                  $filter: {
                    input: '$allReviews',
                    as: 'review',
                    cond: { $ne: ['$$review.status', 'completed'] },
                  },
                },
              },
              discrepancyCount: {
                $size: {
                  $filter: {
                    input: '$allReviews',
                    as: 'review',
                    cond: { $eq: ['$$review.reviewType', 'reconciliation'] },
                  },
                },
              },
            },
          },
          {
            $sort: {
              totalReviewsCount: 1,
              pendingReviewsCount: 1,
              discrepancyCount: 1,
              _id: 1,
            },
          },
          { $limit: 1 }
        ]);

        if (eligibleReviewers.length === 0) {
            // Return eligible reviewers for manual assignment
            const allEligible = await this.getEligibleReviewersForManuscript(manuscriptId);
            res.status(400).json({
                success: false,
                message: 'Could not find an eligible reviewer automatically. Please select one manually.',
                data: { eligibleReviewers: allEligible }
            });
            return;
        }
        selectedReviewer = eligibleReviewers[0];
      }

      if (!selectedReviewer) {
        throw new NotFoundError('Could not select a reviewer.');
      }

      const dueDate = new Date();
      dueDate.setDate(dueDate.getDate() + 21); // 3 weeks from now

      const review = new Review({
        manuscript: manuscriptId,
        reviewer: selectedReviewer._id,
        reviewType: ReviewType.HUMAN,
        status: ReviewStatus.IN_PROGRESS,
        dueDate,
      });

      await review.save();

      try {
        await emailService.sendReviewAssignmentEmail(
          selectedReviewer.email,
          manuscript.title || 'Journal Manuscript',
          (manuscript.submitter as any).name,
          dueDate
        );
      } catch (error) {
        logger.error(
          'Failed to send reviewer notification email:',
          error instanceof Error ? error.message : 'Unknown error'
        );
      }

      manuscript.status = ManuscriptStatus.UNDER_REVIEW;
      await manuscript.save();

      res.status(200).json({
        success: true,
        message: `Manuscript assigned to reviewer successfully`,
        data: {
          reviewer: {
            id: selectedReviewer._id,
            name: selectedReviewer.name,
            email: selectedReviewer.email,
          },
          dueDate,
        },
      });
    }
  );

  getEligibleReviewers = asyncHandler(
    async (req: Request<{ manuscriptId: string }>, res: Response): Promise<void> => {
        const reviewers = await this.getEligibleReviewersForManuscript(req.params.manuscriptId);
        res.status(200).json({
            success: true,
            data: reviewers,
        });
    }
  );

  private async getEligibleReviewersForManuscript(manuscriptId: string): Promise<IUser[]> {
    const manuscript = await Manuscript.findById(manuscriptId).populate('submitter');
    if (!manuscript) {
      throw new NotFoundError('Manuscript not found');
    }

    const submitter = manuscript.submitter as any;
    const eligibleFaculties = getEligibleFaculties(submitter.assignedFaculty);

    const existingReviewerIds = (await Review.find({ manuscript: manuscriptId })).map(r => r.reviewer);

    // Eligible reviewers (non-admins)
    const eligibleReviewers = await User.find({
      role: UserRole.REVIEWER,
      isActive: true,
      assignedFaculty: { $in: eligibleFaculties },
      _id: { $nin: existingReviewerIds },
    });

    // Admins can also be manually assigned
    const adminReviewers = await User.find({ role: UserRole.ADMIN, isActive: true, _id: { $nin: existingReviewerIds } });

    return [...eligibleReviewers, ...adminReviewers];
  }

  checkOverdueReviews = asyncHandler(
    async (
      req: Request,
      res: Response<IAssignReviewResponse>
    ): Promise<void> => {
      const today = new Date();
      const threeWeeksAgo = new Date();
      threeWeeksAgo.setDate(today.getDate() - 21);
      const fourWeeksAgo = new Date();
      fourWeeksAgo.setDate(today.getDate() - 28);
      const fiveWeeksAgo = new Date();
      fiveWeeksAgo.setDate(today.getDate() - 35);
      const sixWeeksAgo = new Date();
      sixWeeksAgo.setDate(today.getDate() - 42);

      // Find reviews that are exactly 3, 4, and 5 weeks overdue
      const overdueReviews = await Review.find({
        status: ReviewStatus.IN_PROGRESS,
        reviewType: ReviewType.HUMAN,
        dueDate: {
          $lt: threeWeeksAgo,
          $gte: sixWeeksAgo,
        },
      }).populate<{
        reviewer: Pick<IUser, 'email' | 'name'>;
        manuscript: Pick<IManuscript, 'title'>;
      }>([
        { path: 'reviewer', select: 'email name' },
        { path: 'manuscript', select: 'title' },
      ]);

      for (const review of overdueReviews as PopulatedReview[]) {
        if (review.reviewer && review.manuscript) {
          const dueDate = new Date(review.dueDate);
          const daysOverdue = Math.floor(
            (today.getTime() - dueDate.getTime()) / (1000 * 3600 * 24)
          );

          let reminderType: '3_WEEKS' | '4_WEEKS' | '5_WEEKS' | null = null;

          if (daysOverdue >= 21 && daysOverdue < 28) {
            reminderType = '3_WEEKS';
          } else if (daysOverdue >= 28 && daysOverdue < 35) {
            reminderType = '4_WEEKS';
          } else if (daysOverdue >= 35 && daysOverdue < 42) {
            reminderType = '5_WEEKS';
          }

          if (reminderType) {
            try {
              await emailService.sendOverdueReviewNotification(
                review.reviewer.email,
                review.reviewer.name,
                review.manuscript.title || 'Journal Manuscript',
                reminderType
              );
              logger.info(
                `Sent ${reminderType} overdue reminder to reviewer ${review.reviewer._id} for review ${review._id}`
              );
            } catch (error) {
              logger.error(
                `Failed to send overdue notification for review ${review._id}:`,
                error instanceof Error ? error.message : 'Unknown error'
              );
            }
          }
        }
      }

      // Mark reviews older than 6 weeks as overdue
      await Review.updateMany(
        {
          status: ReviewStatus.IN_PROGRESS,
          reviewType: ReviewType.HUMAN,
          dueDate: { $lt: sixWeeksAgo },
        },
        { $set: { status: ReviewStatus.OVERDUE } }
      );

      res.status(200).json({
        success: true,
        message: 'Review deadline check completed',
      });
    }
  );
}

export default new AssignReviewController();
