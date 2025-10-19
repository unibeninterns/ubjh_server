import { Request, Response } from 'express';
import User, { UserRole } from '../../model/user.model';
import Manuscript, {
  ManuscriptStatus,
} from '../../Manuscript_Submission/models/manuscript.model';
import { NotFoundError } from '../../utils/customErrors';
import asyncHandler from '../../utils/asyncHandler';
import logger from '../../utils/logger';
import emailService from '../../services/email.service';
import { Types } from 'mongoose';
import userService from '../../services/user.service';

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

class ReviseController {  // Revise a manuscript
  reviseManuscript = asyncHandler(
    async (
      req: Request<{ id: string }, {}, IManuscriptRequest>,
      res: Response<IManuscriptResponse>
    ): Promise<void> => {
      const { id } = req.params;
      const { title, abstract, keywords, submitter, coAuthors } = req.body;

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

      // 3. Verify that the user making the request is the original submitter
      // Note: This assumes you have user authentication middleware that sets req.user
      const userId = (req as any).user.id;
      if (originalManuscript.submitter.toString() !== userId) {
        res.status(403).json({
          success: false,
          message: 'You are not authorized to revise this manuscript.',
        });
        return;
      }

      // Create a placeholder for the revised manuscript to get an ID
      const tempRevisedManuscript = new Manuscript();
      const revisedManuscriptId = tempRevisedManuscript._id;

      // Find or create the submitter and co-authors for the revised manuscript
      const submitterId = await userService.findOrCreateUser(
        submitter.email,
        submitter.name,
        submitter.faculty,
        submitter.affiliation,
        revisedManuscriptId as Types.ObjectId,
        submitter.orcid
      );

      const coAuthorIds: Types.ObjectId[] = [];
      if (coAuthors && coAuthors.length > 0) {
        for (const coAuthor of coAuthors) {
          const coAuthorId = await userService.findOrCreateUser(
            coAuthor.email,
            coAuthor.name,
            coAuthor.faculty,
            coAuthor.affiliation,
            revisedManuscriptId as Types.ObjectId,
            coAuthor.orcid
          );
          coAuthorIds.push(coAuthorId);
        }
      }

      // Create and save the revised manuscript
      const pdfFile = `${
        process.env.API_URL || 'http://localhost:3000'
      }/uploads/documents/${req.file.filename}`;

      const revisedManuscript = new Manuscript({
        _id: revisedManuscriptId,
        title,
        abstract,
        keywords,
        submitter: submitterId,
        coAuthors: coAuthorIds,
        pdfFile,
        originalFilename: req.file.originalname,
        fileSize: req.file.size,
        fileType: req.file.mimetype,
        revisedFrom: originalManuscript._id, // Link to the original manuscript
        status: ManuscriptStatus.SUBMITTED, // The revised manuscript starts as "submitted"
      });
      await revisedManuscript.save();

      // 6. Update the status of the original manuscript to 'REVISED'
      originalManuscript.status = ManuscriptStatus.REVISED;
      await originalManuscript.save();

      // Send confirmation email for the revision
      try {
        await emailService.sendSubmissionConfirmationEmail(
          submitter.email,
          submitter.name,
          title,
          true // isRevision
        );
      } catch (error) {
        logger.error(
          'Failed to send revision submission confirmation email:',
          error instanceof Error ? error.message : 'Unknown error'
        );
      }

      logger.info(`Manuscript ${id} has been revised by: ${submitter.email}`);

      res.status(201).json({
        success: true,
        message: 'Manuscript revised successfully and is under review.',
        data: { manuscriptId: (revisedManuscriptId as any).toString() },
      });
    }
  );
}

export default new ReviseController();
