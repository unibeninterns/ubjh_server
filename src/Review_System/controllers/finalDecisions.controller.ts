import { Request, Response } from 'express';
import Manuscript, {
  ManuscriptStatus,
  ReviewDecision,
} from '../../Manuscript_Submission/models/manuscript.model';
import Review, { ReviewStatus, ReviewType } from '../models/review.model';
import Article from '../../Articles/model/article.model';
import { NotFoundError, UnauthorizedError } from '../../utils/customErrors';
import asyncHandler from '../../utils/asyncHandler';
import logger from '../../utils/logger';
import emailService from '../../services/email.service';
import { IUser } from '../../model/user.model';

interface IAdminResponse {
  success: boolean;
  message?: string;
  data?: any;
  count?: number;
}

interface AdminAuthenticatedRequest extends Request {
  user: {
    id: string;
    role: string;
  };
}

class DecisionsController {
  getManuscriptsForDecision = asyncHandler(
    async (req: Request, res: Response<IAdminResponse>): Promise<void> => {
      const user = (req as AdminAuthenticatedRequest).user;
      if (user.role !== 'admin') {
        throw new UnauthorizedError(
          'You do not have permission to access this resource'
        );
      }

      const manuscripts = await Manuscript.aggregate([
        {
          $lookup: {
            from: 'Reviews',
            localField: '_id',
            foreignField: 'manuscript',
            as: 'reviews',
          },
        },
        {
          $match: {
            $or: [
              // Manuscripts with completed reconciliation
              {
                'reviews.reviewType': ReviewType.RECONCILIATION,
                'reviews.status': ReviewStatus.COMPLETED,
                status: ManuscriptStatus.IN_RECONCILIATION,
              },
              // Manuscripts with 2 completed human reviews (no discrepancy)
              {
                $and: [
                  { 'reviews.reviewType': ReviewType.HUMAN },
                  { 'reviews.status': ReviewStatus.COMPLETED },
                  { 'reviews.1': { $exists: true } },
                  { status: ManuscriptStatus.UNDER_REVIEW },
                  // Check no discrepancy
                  {
                    $expr: {
                      $let: {
                        vars: {
                          humanReviews: {
                            $filter: {
                              input: '$reviews',
                              as: 'review',
                              cond: {
                                $and: [
                                  { $eq: ['$$review.reviewType', 'human'] },
                                  { $eq: ['$$review.status', 'completed'] },
                                ],
                              },
                            },
                          },
                        },
                        in: {
                          $eq: [
                            {
                              $arrayElemAt: [
                                '$$humanReviews.reviewDecision',
                                0,
                              ],
                            },
                            {
                              $arrayElemAt: [
                                '$$humanReviews.reviewDecision',
                                1,
                              ],
                            },
                          ],
                        },
                      },
                    },
                  },
                ],
              },
            ],
          },
          // ... rest of aggregation
        },
      ]);

      res.status(200).json({
        success: true,
        count: manuscripts.length,
        data: manuscripts,
      });
    }
  );

  updateManuscriptStatus = asyncHandler(
    async (req: Request, res: Response<IAdminResponse>): Promise<void> => {
      const user = (req as AdminAuthenticatedRequest).user;
      if (user.role !== 'admin') {
        throw new UnauthorizedError(
          'You do not have permission to access this resource'
        );
      }

      const { manuscriptId } = req.params;
      const { status, feedbackComments } = req.body;

      // Validate status is a final decision status
      const validStatuses = [
        ManuscriptStatus.APPROVED,
        ManuscriptStatus.REJECTED,
        ManuscriptStatus.MINOR_REVISION,
        ManuscriptStatus.MAJOR_REVISION,
      ];

      if (!validStatuses.includes(status)) {
        res.status(400).json({
          success: false,
          message:
            'Invalid status. Must be approved, rejected, minor_revision, or major_revision',
        });
        return;
      }

      const manuscript = await Manuscript.findById(manuscriptId).populate(
        'submitter coAuthors'
      );

      if (!manuscript) {
        throw new NotFoundError('Manuscript not found');
      }

      // For major revisions, store the reviewer who recommended it
      if (status === ManuscriptStatus.MAJOR_REVISION) {
        const majorRevisionReview = await Review.findOne({
          manuscript: manuscriptId,
          reviewDecision: ReviewDecision.PUBLISHABLE_WITH_MAJOR_REVISION,
          status: ReviewStatus.COMPLETED,
        }).sort({ completedAt: -1 });

        if (majorRevisionReview) {
          manuscript.originalReviewer = majorRevisionReview.reviewer;
          manuscript.revisionType = 'major';
        }
      } else if (status === ManuscriptStatus.MINOR_REVISION) {
        manuscript.revisionType = 'minor';
      }

      manuscript.status = status;
      if (feedbackComments) {
        manuscript.reviewComments = {
          ...(manuscript.reviewComments || {}),
          commentsForAuthor: feedbackComments,
        };
      }

      if (status === ManuscriptStatus.APPROVED) {
        const newArticle = new Article({
          title: manuscript.title,
          abstract: manuscript.abstract,
          keywords: manuscript.keywords,
          pdfFile: manuscript.revisedPdfFile || manuscript.pdfFile, // Use revised if available
          author: manuscript.submitter,
          coAuthors: manuscript.coAuthors,
          manuscriptId: manuscript._id,
          doi: `10.xxxx/journal.v${new Date().getFullYear()}.${manuscript._id}`,
          volume: new Date().getFullYear(),
          issue: 1,
        });
        await newArticle.save();
        logger.info(`New article created from manuscript ${manuscriptId}`);
      }

      await manuscript.save();

      const submitter = manuscript.submitter as any as IUser;

      try {
        await emailService.sendManuscriptStatusUpdateEmail(
          submitter.email,
          submitter.name,
          manuscript.title,
          manuscript.status
        );
      } catch (error) {
        logger.error(
          'Failed to send status update email:',
          error instanceof Error ? error.message : 'Unknown error'
        );
      }

      logger.info(
        `Admin ${user.id} updated status for manuscript ${manuscriptId} to ${status}`
      );

      res.status(200).json({
        success: true,
        message: 'Manuscript status updated successfully',
        data: manuscript,
      });
    }
  );
}

export default new DecisionsController();
