import { Request, Response } from 'express';
import Manuscript, { ManuscriptStatus } from '../models/manuscript.model';
import asyncHandler from '../../utils/asyncHandler';
import logger from '../../utils/logger';
import emailService from '../../services/email.service';
import { Types } from 'mongoose';
import userService from '../../services/user.service';
import IncompleteCoAuthor from '../models/incompleteCoAuthor.model';

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
    email?: string;
    name?: string;
    faculty?: string;
    affiliation?: string;
    orcid?: string;
  }[]; // List of co-author emails and names
}

interface IManuscriptResponse {
  success: boolean;
  message?: string;
  data?: any;
  count?: number;
}

class SubmitController {
  submitManuscript = asyncHandler(
    async (
      req: Request<{}, {}, any>,
      res: Response<IManuscriptResponse>
    ): Promise<void> => {
      const { title, abstract, keywords, submitter, coAuthors } = req.body;

      // Validate required fields
      if (!title || !abstract || !keywords || !submitter) {
        res.status(400).json({
          success: false,
          message:
            'Missing required fields: title, abstract, keywords, and submitter information are required.',
        });
        return;
      }

      if (!req.file) {
        res.status(400).json({
          success: false,
          message: 'Manuscript PDF file is required.',
        });
        return;
      }

      // Validate ORCID format for submitter
      const orcidRegex = /^\d{4}-\d{4}-\d{4}-\d{3}[0-9X]$/;
      if (submitter.orcid && !orcidRegex.test(submitter.orcid)) {
        res.status(400).json({
          success: false,
          message:
            'Invalid ORCID format. Please use the format: 0000-0000-0000-0000',
        });
        return;
      }

      // Create a placeholder manuscript to get an ID
      const tempManuscript = new Manuscript();
      const manuscriptId = tempManuscript._id;

      // Find or create the submitter
      const submitterId = await userService.findOrCreateUser(
        submitter.email,
        submitter.name,
        submitter.faculty,
        submitter.affiliation,
        manuscriptId as Types.ObjectId,
        submitter.orcid
      );

      // Process co-authors
      const coAuthorIds: Types.ObjectId[] = [];
      const incompleteCoAuthorIds: Types.ObjectId[] = [];
      if (coAuthors && coAuthors.length > 0) {
        for (const coAuthor of coAuthors) {
          // Validate co-author ORCID if provided
          if (coAuthor.orcid && !orcidRegex.test(coAuthor.orcid)) {
            res.status(400).json({
              success: false,
              message: `Invalid ORCID format for co-author ${coAuthor.name}. Please use the format: 0000-0000-0000-0000`,
            });
            return;
          }

          // Check if co-author is complete
          if (
            coAuthor.email &&
            coAuthor.name &&
            coAuthor.faculty &&
            coAuthor.affiliation
          ) {
            const coAuthorId = await userService.findOrCreateUser(
              coAuthor.email,
              coAuthor.name,
              coAuthor.faculty,
              coAuthor.affiliation,
              manuscriptId as Types.ObjectId,
              coAuthor.orcid
            );
            coAuthorIds.push(coAuthorId);
          } else {
            const incompleteCoAuthor = new IncompleteCoAuthor({
              manuscript: manuscriptId,
              ...coAuthor,
            });
            await incompleteCoAuthor.save();
            incompleteCoAuthorIds.push(
              incompleteCoAuthor._id as Types.ObjectId
            );
          }
        }
      }

      // Create and save the new manuscript
      const pdfFile = `${process.env.API_URL || 'http://localhost:3000'}/uploads/documents/${req.file.filename}`;

      const newManuscript = new Manuscript({
        _id: manuscriptId,
        title,
        abstract,
        keywords,
        submitter: submitterId,
        coAuthors: coAuthorIds,
        incompleteCoAuthors: incompleteCoAuthorIds,
        pdfFile,
        originalFilename: req.file.originalname,
        fileSize: req.file.size,
        fileType: req.file.mimetype,
      });

      await newManuscript.save();

      // Send confirmation email to the submitter
      try {
        await emailService.sendSubmissionConfirmationEmail(
          submitter.email,
          submitter.name,
          title
        );
      } catch (error) {
        logger.error(
          'Failed to send submission confirmation email:',
          error instanceof Error ? error.message : 'Unknown error'
        );
      }

      logger.info(`New manuscript submitted by: ${submitter.email}`);

      res.status(201).json({
        success: true,
        message:
          'Manuscript submitted successfully and is under review. You will receive your login credentials within 24 hours.',
        data: { manuscriptId: (manuscriptId as any).toString() },
      });
    }
  );
}

export default new SubmitController();
