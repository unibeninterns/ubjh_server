import { Request, Response } from 'express';
import User, { UserRole } from '../../model/user.model';
import Manuscript, { IManuscript } from '../../Manuscript_Submission/models/manuscript.model';
import { BadRequestError, NotFoundError } from '../../utils/customErrors';
import emailService from '../../services/email.service';
import generateSecurePassword from '../../utils/passwordGenerator';
import asyncHandler from '../../utils/asyncHandler';
import logger from '../../utils/logger';

interface AdminAuthenticatedRequest extends Request {
  user: {
    _id: string;
    role: string;
  };
}

class AuthorManagementController {
  // Get all authors
  getAuthors = asyncHandler(
    async (req: Request, res: Response): Promise<void> => {
      const user = (req as AdminAuthenticatedRequest).user;
      // Find all users with the author role
      const authors = await User.find({ role: UserRole.AUTHOR }).select(
        '_id name email credentialsSent credentialsSentAt lastLogin orcid affiliation assignedFaculty faculty'
      );

      // For each author, count their manuscripts
      const authorData = await Promise.all(
        authors.map(async (author) => {
          const mainAuthorCount = await Manuscript.countDocuments({
            submitter: author._id,
          });
          const coAuthorCount = await Manuscript.countDocuments({
            coAuthors: author._id,
          });
          return {
            ...author.toObject(),
            manuscriptCount: mainAuthorCount + coAuthorCount,
            manuscriptCountBreakdown: {
              main: mainAuthorCount,
              coAuthored: coAuthorCount,
            },
          };
        })
      );

      logger.info(`Admin ${user._id} retrieved authors list`);

      res.status(200).json({
        success: true,
        count: authorData.length,
        data: authorData,
      });
    }
  );

  // Send login credentials to an author
  sendAuthorCredentials = asyncHandler(
    async (req: Request, res: Response): Promise<void> => {
      const user = (req as AdminAuthenticatedRequest).user;
      const { authorId } = req.params;

      const author = await User.findById(authorId);
      if (!author) {
        throw new NotFoundError('Author not found');
      }

      // Generate a secure password
      const generatedPassword = generateSecurePassword();

      // Update the author record
      author.password = generatedPassword;
      author.role = UserRole.AUTHOR;
      author.isActive = true;
      author.credentialsSent = true;
      author.credentialsSentAt = new Date();
      await author.save();

      // Send credentials email
      await emailService.sendAuthorCredentialsEmail(
        author.email,
        author.name,
        generatedPassword
      );

      logger.info(
        `Admin ${user._id} sent credentials to author ${authorId}`
      );

      res.status(200).json({
        success: true,
        message: 'Login credentials sent successfully',
      });
    }
  );

  // Get author details with manuscripts
  getAuthorDetails = asyncHandler(
    async (req: Request, res: Response): Promise<void> => {
      const user = (req as AdminAuthenticatedRequest).user;
      const { authorId } = req.params;

      const author = await User.findById(authorId)
        .select('-password -refreshToken');

      if (!author) {
        throw new NotFoundError('Author not found');
      }

      // Find all manuscripts by this author
      const manuscripts = await Manuscript.find({
        $or: [{ submitter: authorId }, { coAuthors: authorId }],
      }).sort({
        updatedAt: -1,
      });

      const manuscriptsWithRole = manuscripts.map((manuscript) => {
        const manuscriptObject = manuscript.toObject() as IManuscript & { authorRole?: string };
        if (manuscriptObject.submitter.toString() === authorId) {
          manuscriptObject.authorRole = 'main';
        } else {
          manuscriptObject.authorRole = 'co-author';
        }
        return manuscriptObject;
      });

      logger.info(
        `Admin ${user._id} accessed author ${authorId} details`
      );

      res.status(200).json({
        success: true,
        data: {
          author: {
            ...author.toObject(),
            assignedFaculty: author.assignedFaculty,
          },
          manuscripts: manuscriptsWithRole,
        },
      });
    }
  );

  // Resend credentials to an author
  resendAuthorCredentials = asyncHandler(
    async (req: Request, res: Response): Promise<void> => {
      const user = (req as AdminAuthenticatedRequest).user;
      const { authorId } = req.params;

      const author = await User.findById(authorId);
      if (!author) {
        throw new NotFoundError('Author not found');
      }

      if (!author.credentialsSent) {
        throw new BadRequestError(
          'Credentials have not been sent yet. Use send credentials instead.'
        );
      }

      // Generate a new password
      const generatedPassword = generateSecurePassword();

      // Update the author record
      author.password = generatedPassword;
      author.credentialsSentAt = new Date();
      await author.save();

      // Send credentials email
      await emailService.sendAuthorCredentialsEmail(
        author.email,
        author.name,
        generatedPassword
      );

      logger.info(
        `Admin ${user._id} resent credentials to author ${authorId}`
      );

      res.status(200).json({
        success: true,
        message: 'Login credentials resent successfully',
      });
    }
  );
}

export default new AuthorManagementController();
