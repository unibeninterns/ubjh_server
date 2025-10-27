import { Request, Response } from 'express';
import User, { UserRole } from '../../model/user.model';
import Manuscript, {
  ManuscriptStatus,
} from '../../Manuscript_Submission/models/manuscript.model';
import { NotFoundError } from '../../utils/customErrors';
import asyncHandler from '../../utils/asyncHandler';
import logger from '../../utils/logger';
import emailService from '../../services/email.service';
import Review, {
  ReviewStatus,
  ReviewType,
} from '../../Review_System/models/review.model';

// Interface for the new manuscript submission request
interface IManuscriptRequest {
  title: string;
  abstract: string;
  keywords: string[];
  submitter: {
    name: string;
    email: string;
    faculty: string;
    affiliation: string;
    orcid?: string;
  }; // Primary author
  coAuthors?: {
    email: string;
    name: string;
    faculty: string;
    affiliation: string;
    orcid?: string;
  }[]; // List of co-author emails and names
}

interface IManuscriptResponse {
  success: boolean;
  message?: string;
  data?: any;
  count?: number;
}

class ReviseController {
  // Revise a manuscript
  reviseManuscript = asyncHandler(
    async (
      req: Request<{ id: string }, {}, IManuscriptRequest>,
      res: Response<IManuscriptResponse>
    ): Promise<void> => {
      const { id } = req.params;
      const { title, abstract, keywords, submitter } = req.body;

      if (!req.file) {
        res.status(400).json({
          success: false,
          message: 'Manuscript PDF file is required.',
        });
        return;
      }

      // 1. Find the original manuscript
      const originalManuscript = await Manuscript.findById(id);
      if (!originalManuscript) {
        throw new NotFoundError('Original manuscript not found');
      }

      // 2. Check if the manuscript is in a state that allows revision
      if (
        originalManuscript.status !== ManuscriptStatus.MINOR_REVISION &&
        originalManuscript.status !== ManuscriptStatus.MAJOR_REVISION
      ) {
        res.status(403).json({
          success: false,
          message: 'This manuscript is not in a state that allows revision.',
        });
        return;
      }

      // 3. Verify authorization
      const userId = (req as any).user.id;
      if (originalManuscript.submitter.toString() !== userId) {
        res.status(403).json({
          success: false,
          message: 'You are not authorized to revise this manuscript.',
        });
        return;
      }

      const pdfFile = `${
        process.env.API_URL || 'http://localhost:3000'
      }/uploads/documents/${req.file.filename}`;

      // Update the original manuscript with revised PDF
      originalManuscript.revisedPdfFile = pdfFile;
      originalManuscript.title = title;
      originalManuscript.abstract = abstract;
      originalManuscript.keywords = keywords;

      // Reset status to submitted for re-review
      const isMinorRevision = originalManuscript.revisionType === 'minor';
      originalManuscript.status = ManuscriptStatus.SUBMITTED;

      await originalManuscript.save();

      // Auto-assign based on revision type
      if (isMinorRevision) {
        // Assign to admin for minor revision
        const admin = await User.findOne({
          role: UserRole.ADMIN,
          isActive: true,
        });
        if (admin) {
          const dueDate = new Date(Date.now() + 21 * 24 * 60 * 60 * 1000);
          const review = new Review({
            manuscript: originalManuscript._id,
            reviewer: admin._id,
            reviewType: ReviewType.HUMAN,
            status: ReviewStatus.IN_PROGRESS,
            dueDate,
          });
          await review.save();
          originalManuscript.status = ManuscriptStatus.UNDER_REVIEW;
          await originalManuscript.save();

          try {
            await emailService.sendReviewAssignmentEmail(
              admin.email,
              title,
              submitter.name,
              dueDate
            );
          } catch (error) {
            logger.error(
              'Failed to send admin review assignment email:',
              error
            );
          }
        }
      } else if (originalManuscript.originalReviewer) {
        // Assign to original reviewer for major revision
        const dueDate = new Date(Date.now() + 21 * 24 * 60 * 60 * 1000);
        const review = new Review({
          manuscript: originalManuscript._id,
          reviewer: originalManuscript.originalReviewer,
          reviewType: ReviewType.HUMAN,
          status: ReviewStatus.IN_PROGRESS,
          dueDate,
        });
        await review.save();
        originalManuscript.status = ManuscriptStatus.UNDER_REVIEW;
        await originalManuscript.save();

        const reviewer = await User.findById(
          originalManuscript.originalReviewer
        );
        if (reviewer) {
          try {
            await emailService.sendReviewAssignmentEmail(
              reviewer.email,
              title,
              submitter.name,
              dueDate
            );
          } catch (error) {
            logger.error('Failed to send reviewer assignment email:', error);
          }
        }
      }

      // Send confirmation email
      try {
        await emailService.sendSubmissionConfirmationEmail(
          submitter.email,
          submitter.name,
          title,
          true
        );
      } catch (error) {
        logger.error(
          'Failed to send revision submission confirmation email:',
          error instanceof Error ? error.message : 'Unknown error'
        );
      }

      logger.info(`Manuscript ${id} has been revised by: ${submitter.email}`);

      res.status(200).json({
        success: true,
        message: 'Manuscript revised successfully and assigned for review.',
        data: { manuscriptId: originalManuscript._id.toString() },
      });
    }
  );
}

export default new ReviseController();
