import { Request, Response, NextFunction } from 'express';
import mongoose from 'mongoose';
import Review, { ReviewStatus, ReviewType } from '../models/review.model';
import Manuscript, {
  ManuscriptStatus,
} from '../../Manuscript_Submission/models/manuscript.model';
import User, { UserRole } from '../../model/user.model';
import { NotFoundError, BadRequestError } from '../../utils/customErrors';
import logger from '../../utils/logger';
import emailService from '../../services/email.service';
import { getEligibleFaculties } from '../../utils/facultyClusters';
import asyncHandler from '../../utils/asyncHandler';

class ReconciliationController {
  handleDiscrepancy = asyncHandler(
    async (req: Request, res: Response, next: NextFunction) => {
      const { manuscriptId } = req.params;

      const reviews = await Review.find({
        manuscript: manuscriptId,
        reviewType: ReviewType.HUMAN,
        status: ReviewStatus.COMPLETED,
      });

      if (reviews.length < 2) {
        throw new BadRequestError(
          'Not enough completed reviews to check for discrepancies'
        );
      }

      const [review1, review2] = reviews;

      if (review1.reviewDecision === review2.reviewDecision) {
        return res
          .status(200)
          .json({ success: true, message: 'No discrepancy found.' });
      }

      // Discrepancy found, assign reconciliation reviewer
      const existingReconciliation = await Review.findOne({
        manuscript: manuscriptId,
        reviewType: ReviewType.RECONCILIATION,
      });

      if (existingReconciliation) {
        return res.status(400).json({
          success: false,
          message: 'A reconciliation review has already been assigned.',
        });
      }
      const manuscript =
        await Manuscript.findById(manuscriptId).populate('submitter');
      if (!manuscript) {
        throw new NotFoundError('Manuscript not found');
      }

      if (manuscript.isArchived) {
        throw new BadRequestError(
          'Cannot assign reconciliation to an archived manuscript.'
        );
      }

      const submitter = manuscript.submitter as any;
      const eligibleFaculties = getEligibleFaculties(submitter.assignedFaculty);

      const existingReviewerIds = reviews.map((r) => r.reviewer.toString());

      const reconciliationReviewer = await User.findOne({
        role: UserRole.REVIEWER,
        isActive: true,
        assignedFaculty: { $in: eligibleFaculties },
        _id: { $nin: existingReviewerIds },
      });

      if (!reconciliationReviewer) {
        throw new NotFoundError('No eligible reconciliation reviewer found');
      }

      const dueDate = new Date(Date.now() + 21 * 24 * 60 * 60 * 1000); // 3 weeks

      const reconciliationReview = new Review({
        manuscript: manuscriptId,
        reviewer: reconciliationReviewer._id as mongoose.Types.ObjectId,
        reviewType: ReviewType.RECONCILIATION,
        status: ReviewStatus.IN_PROGRESS,
        dueDate,
      });

      await reconciliationReview.save();

      manuscript.status = ManuscriptStatus.IN_RECONCILIATION;
      await manuscript.save();

      try {
        await emailService.sendReconciliationAssignmentEmail(
          reconciliationReviewer.email,
          reconciliationReviewer.name,
          manuscript.title,
          dueDate
        );
      } catch (error) {
        logger.error(
          'Failed to send reconciliation assignment email:',
          error instanceof Error ? error.message : 'Unknown error'
        );
      }

      res.status(200).json({
        success: true,
        message: 'Discrepancy found. Reconciliation reviewer assigned.',
        data: { reconciliationReviewer, dueDate },
      });
    }
  );
}

export default new ReconciliationController();
