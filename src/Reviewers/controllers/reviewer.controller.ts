/* eslint-disable max-lines */
import { Request, Response } from 'express';
import crypto from 'crypto';
import User, { UserRole } from '../../model/user.model';
import Manuscript from '../../Manuscript_Submission/models/manuscript.model';
import Review, { ReviewStatus } from '../../Review_System/models/review.model';
import emailService from '../../services/email.service';
import {
  BadRequestError,
  NotFoundError,
  UnauthorizedError,
} from '../../utils/customErrors';
import asyncHandler from '../../utils/asyncHandler';
import logger from '../../utils/logger';
import generateSecurePassword from '../../utils/passwordGenerator';
import { Types } from 'mongoose';

interface IPaginationOptions {
  page: number;
  limit: number;
  sort: Record<string, 1 | -1>;
}

interface IReviewerResponse {
  success: boolean;
  count?: number;
  totalPages?: number;
  currentPage?: number;
  message?: string;
  data?: any;
}

interface AuthenticatedRequest extends Request {
  user: {
    _id: string;
    email?: string;
    role: string;
  };
}

class ReviewerController {
  // Invite a reviewer by email
  inviteReviewer = asyncHandler(
    async (req: Request, res: Response): Promise<void> => {
      const { email } = req.body;

      logger.info(`Reviewer invitation request received for email: ${email}`);

      const existingReviewer = await User.findOne({ email });
      if (existingReviewer) {
        logger.warn(`Attempt to invite already registered email: ${email}`);
        throw new BadRequestError('Email already registered');
      }

      // Generate invite token
      const inviteToken = crypto.randomBytes(32).toString('hex');
      const hashedToken = crypto
        .createHash('sha256')
        .update(inviteToken)
        .digest('hex');

      // Store invitation
      await User.create({
        email,
        inviteToken: hashedToken,
        inviteTokenExpires: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 days
        role: UserRole.REVIEWER,
        invitationStatus: 'pending',
        isActive: false,
      });

      logger.info(`Created reviewer invitation record for email: ${email}`);

      // Send invitation email
      await emailService.sendReviewerInvitationEmail(email, inviteToken);
      logger.info(`Reviewer invitation email sent to: ${email}`);

      res.status(200).json({
        success: true,
        message: 'Reviewer invitation sent successfully',
      });
    }
  );

  // Complete reviewer profile from invitation
  completeReviewerProfile = asyncHandler(
    async (req: Request, res: Response): Promise<void> => {
      const { token } = req.params;
      const { name, faculty, affiliation } = req.body;

      logger.info(
        `Reviewer profile completion attempt with token: ${token.substring(
          0,
          8
        )}...`
      );

      const hashedToken = crypto
        .createHash('sha256')
        .update(token)
        .digest('hex');

      const reviewer = await User.findOne({
        inviteToken: hashedToken,
        inviteTokenExpires: { $gt: Date.now() },
      });

      if (!reviewer) {
        logger.warn(
          `Invalid or expired reviewer invitation token: ${token.substring(
            0,
            8
          )}...`
        );
        throw new BadRequestError('Invalid or expired invitation token');
      }

      // Generate a secure password for the reviewer
      const generatedPassword = generateSecurePassword();

      // Update reviewer profile
      reviewer.name = name;
      reviewer.faculty = faculty;
      reviewer.affiliation = affiliation;
      reviewer.password = generatedPassword;
      reviewer.isActive = true;
      reviewer.credentialsSent = true;
      reviewer.credentialsSentAt = new Date();
      reviewer.inviteToken = undefined;
      reviewer.inviteTokenExpires = undefined;
      reviewer.invitationStatus = 'accepted';

      await reviewer.save();
      logger.info(`Reviewer profile completed for: ${reviewer.email}`);

      // Send login credentials to the reviewer
      await emailService.sendReviewerCredentialsEmail(
        reviewer.email,
        reviewer.name,
        generatedPassword
      );
      logger.info(`Login credentials sent to reviewer: ${reviewer.email}`);

      res.status(200).json({
        success: true,
        message:
          'Profile completed successfully. Login credentials have been sent to your email.',
      });
    }
  );

  // Add a reviewer profile manually (without invitation)
  addReviewerProfile = asyncHandler(
    async (req: Request, res: Response): Promise<void> => {
      const user = (req as AuthenticatedRequest).user;
      // Check if user is admin
      if (user.role !== 'admin') {
        throw new UnauthorizedError(
          'You do not have permission to access this resource'
        );
      }

      const { email, name, faculty, affiliation } = req.body;

      logger.info(
        `Manual reviewer profile creation request for email: ${email}`
      );

      // Check if reviewer already exists
      const existingReviewer = await User.findOne({ email });
      if (existingReviewer) {
        logger.warn(
          `Attempt to create profile for already registered email: ${email}`
        );
        throw new BadRequestError('Email already registered as a reviewer');
      }

      // Generate a secure password for the reviewer
      const generatedPassword = generateSecurePassword();

      // Create new reviewer profile
      const newReviewer = await User.create({
        email,
        name,
        faculty,
        affiliation,
        password: generatedPassword,
        role: UserRole.REVIEWER,
        credentialsSent: true,
        credentialsSentAt: new Date(),
        isActive: true,
        invitationStatus: 'added',
      });

      logger.info(`Reviewer profile manually created for: ${email}`);

      // Send login credentials to the reviewer
      await emailService.sendReviewerCredentialsEmail(
        email,
        name,
        generatedPassword
      );
      logger.info(`Login credentials sent to reviewer: ${email}`);

      res.status(201).json({
        success: true,
        message:
          'Reviewer profile created successfully. Login credentials have been sent to their email.',
        data: {
          id: newReviewer._id,
          email: newReviewer.email,
          name: newReviewer.name,
          faculty: newReviewer.faculty,
          affiliation: newReviewer.affiliation,
        },
      });
    }
  );

  // Get all reviewers with pagination, filtering, and statistics
  getAllReviewers = asyncHandler(
    async (req: Request, res: Response<IReviewerResponse>): Promise<void> => {
      const user = (req as AuthenticatedRequest).user;
      // Check if user is admin
      if (user.role !== 'admin') {
        throw new UnauthorizedError(
          'You do not have permission to access this resource'
        );
      }

      const {
        page = 1,
        limit = 10,
        status,
        faculty,
        sort = 'createdAt',
        order = 'desc',
      } = req.query;

      // Base query to filter only reviewers
      const query: any = {
        role: UserRole.REVIEWER, // Add this filter for reviewers only
      };

      // Apply additional filters if provided
      if (status) query.invitationStatus = status as string;
      if (faculty) query.faculty = faculty as string;

      // Build sort object
      const sortObj: Record<string, 1 | -1> = {};
      sortObj[sort as string] = order === 'asc' ? 1 : -1;

      const options: IPaginationOptions = {
        page: parseInt(page as string, 10),
        limit: parseInt(limit as string, 10),
        sort: sortObj,
      };

      const reviewers = await User.find(query)
        .sort(sortObj)
        .skip((options.page - 1) * options.limit)
        .limit(options.limit)
        .populate({
          path: 'assignedReviews',
          select: 'title submitter', // Select relevant fields from Manuscript
          populate: {
            path: 'submitter',
            select: 'name email', // Select relevant fields from Submitter (User)
          },
        });

      const totalReviewers = await User.countDocuments(query);

      // Get statistics and assigned proposals for each reviewer
      const reviewersWithDetails = await Promise.all(
        reviewers.map(async (reviewer) => {
          // Get assigned reviews (all reviews assigned to this reviewer)
          // This count is based on the Review model, not directly from User.assignedReviews
          const assignedReviewsCount = await Review.countDocuments({
            reviewer: reviewer._id,
          });

          // Get completed reviews
          const completedReviewsCount = await Review.countDocuments({
            reviewer: reviewer._id,
            status: ReviewStatus.COMPLETED,
          });

          // Calculate completion rate
          const completionRate =
            assignedReviewsCount > 0
              ? Math.round((completedReviewsCount / assignedReviewsCount) * 100)
              : 0;

          return {
            ...reviewer.toObject(),
            statistics: {
              assigned: assignedReviewsCount,
              completed: completedReviewsCount,
              completionRate,
            },
            // Include the populated assignedReviews directly
            assignedReviews: reviewer.assignedReviews,
          };
        })
      );

      logger.info(`Admin ${user._id} retrieved reviewers list`);

      res.status(200).json({
        success: true,
        count: reviewers.length,
        totalPages: Math.ceil(totalReviewers / options.limit),
        currentPage: options.page,
        data: reviewersWithDetails,
      });
    }
  );

  // Get reviewer by ID
  getReviewerById = asyncHandler(
    async (req: Request, res: Response<IReviewerResponse>): Promise<void> => {
      const user = (req as AuthenticatedRequest).user;
      // Check if user is admin
      if (user.role !== 'admin') {
        throw new UnauthorizedError(
          'You do not have permission to access this resource'
        );
      }

      const { id } = req.params;

      const reviewer = await User.findOne({
        _id: id,
        role: UserRole.REVIEWER,
      });
      if (!reviewer) {
        throw new NotFoundError('Reviewer not found');
      }

      // Fetch all reviews assigned to this reviewer
      const allAssignedReviews = await Review.find({
        reviewer: reviewer._id,
      }).populate({
        path: 'manuscript',
        select: 'title submitter',
        populate: {
          path: 'submitter',
          select: 'name email',
        },
      });

      // Filter reviews by status
      const completedReviews = allAssignedReviews.filter(
        (review) => review.status === ReviewStatus.COMPLETED
      );
      const inProgressReviews = allAssignedReviews.filter(
        (review) => review.status === ReviewStatus.IN_PROGRESS
      );
      const overdueReviews = allAssignedReviews.filter(
        (review) => review.status === ReviewStatus.OVERDUE
      );

      // Combine in-progress and overdue reviews to represent "assigned journals reviews" (incomplete ones)
      const assignedReviews = [...inProgressReviews, ...overdueReviews];

      logger.info(`Admin ${user._id} retrieved reviewer ${id}`);

      res.status(200).json({
        success: true,
        data: {
          ...reviewer.toObject(), // Convert Mongoose document to plain object
          // Set assignedReviews to be the list of incomplete reviews as per user's clarification
          assignedReviews: assignedReviews,
          allAssignedReviews, // Still provide all assigned review documents
          completedReviews,
          inProgressReviews,
          overdueReviews,
        },
      });
    }
  );

  // Delete a reviewer
  deleteReviewer = asyncHandler(
    async (req: Request, res: Response): Promise<void> => {
      const user = (req as AuthenticatedRequest).user;
      // Check if user is admin
      if (user.role !== 'admin') {
        throw new UnauthorizedError(
          'You do not have permission to access this resource'
        );
      }

      const { id } = req.params;

      // Validate ObjectId format
      if (!Types.ObjectId.isValid(id)) {
        throw new BadRequestError('Invalid reviewer ID');
      }

      const reviewer = await User.findById(id);
      if (!reviewer) {
        throw new NotFoundError('Reviewer not found');
      }

      // Check if reviewer has assigned journals
      if ((reviewer.assignedReviews ?? []).length > 0) {
        throw new BadRequestError(
          'Cannot delete reviewer with assigned journals. Please reassign them first.'
        );
      }

      await User.findByIdAndDelete(id);
      logger.info(`Admin ${user._id} deleted reviewer ${id}`);

      res.status(200).json({
        success: true,
        message: 'Reviewer deleted successfully',
      });
    }
  );

  // Get all reviewer invitations
  getInvitations = asyncHandler(
    async (req: Request, res: Response<IReviewerResponse>): Promise<void> => {
      const user = (req as AuthenticatedRequest).user;
      // Check if user is admin
      if (user.role !== 'admin') {
        throw new UnauthorizedError(
          'You do not have permission to access this resource'
        );
      }

      // Update expired invitations
      await User.updateMany(
        {
          role: UserRole.REVIEWER,
          invitationStatus: 'pending',
          inviteTokenExpires: { $lt: new Date() },
        },
        { invitationStatus: 'expired' }
      );

      const invitations = await User.find({
        role: UserRole.REVIEWER,
        invitationStatus: { $in: ['pending', 'expired', 'accepted', 'added'] },
      }).select(
        '_id email assignedFaculty assignedReviews inviteTokenExpires createdAt invitationStatus'
      );

      const formattedInvitations = invitations.map((invitation) => ({
        id: invitation._id,
        email: invitation.email,
        status: invitation.invitationStatus,
        created: invitation.createdAt.toISOString().split('T')[0],
        assignedFaculty: invitation.assignedFaculty ?? null,
        assignedReviews: invitation.assignedReviews ?? null,
        expires: invitation.inviteTokenExpires
          ? invitation.inviteTokenExpires.toISOString().split('T')[0]
          : null,
      }));

      logger.info(`Admin ${user._id} retrieved reviewer invitations list`);

      res.status(200).json({
        success: true,
        data: formattedInvitations,
      });
    }
  );

  // Resend invitation
  resendInvitation = asyncHandler(
    async (req: Request, res: Response): Promise<void> => {
      const user = (req as AuthenticatedRequest).user;
      // Check if user is admin
      if (user.role !== 'admin') {
        throw new UnauthorizedError(
          'You do not have permission to access this resource'
        );
      }

      const { id } = req.params;

      const reviewer = await User.findById(id);
      if (!reviewer) {
        throw new NotFoundError('Reviewer not found');
      }

      if (reviewer.invitationStatus !== 'pending') {
        throw new BadRequestError(
          'Can only resend invitations for pending reviewers'
        );
      }

      // Generate new invite token
      const inviteToken = crypto.randomBytes(32).toString('hex');
      const hashedToken = crypto
        .createHash('sha256')
        .update(inviteToken)
        .digest('hex');

      // Update reviewer with new token
      reviewer.inviteToken = hashedToken;
      reviewer.inviteTokenExpires = new Date(
        Date.now() + 30 * 24 * 60 * 60 * 1000
      ); // 30 days

      await reviewer.save();
      logger.info(`Reviewer invitation resent for email: ${reviewer.email}`);

      // Send invitation email
      await emailService.sendReviewerInvitationEmail(
        reviewer.email,
        inviteToken
      );
      logger.info(`Reviewer invitation email resent to: ${reviewer.email}`);

      res.status(200).json({
        success: true,
        message: 'Reviewer invitation resent successfully',
      });
    }
  );

  // Get reviewer dashboard
  getReviewerDashboard = asyncHandler(
    async (req: Request, res: Response): Promise<void> => {
      const user = (req as AuthenticatedRequest).user;

      const userId = user._id;
      logger.info(`Reviewer dashboard request for user: ${userId}`);

      const reviewer = await User.findById(userId).select(
        '-password -refreshToken'
      );

      if (!reviewer) {
        throw new NotFoundError('Reviewer not found');
      }

      // Get assigned journals with details
      const assignedReviews = await Manuscript.find({
        _id: { $in: reviewer.assignedReviews },
      })
        .populate('submitter', 'name email')
        .select('-pdfFile');

      // Get completed reviews
      const completedReviews = await Review.find({
        reviewer: userId,
        status: ReviewStatus.COMPLETED,
      }).populate('manuscript', 'title');

      // Get in-progress reviews
      const inProgressReviews = await Review.find({
        reviewer: userId,
        status: ReviewStatus.IN_PROGRESS,
      }).populate('manuscript', 'title');

      // Get overdue reviews
      const overdueReviews = await Review.find({
        reviewer: userId,
        status: ReviewStatus.OVERDUE,
      }).populate('manuscript', 'title');

      const totalAssigned = await Review.find({
        reviewer: userId,
      }).populate('manuscript', 'title');

      logger.info(`Reviewer ${userId} viewed their dashboard`);

      res.status(200).json({
        success: true,
        data: {
          reviewer: {
            name: reviewer.name,
            email: reviewer.email,
            faculty: reviewer.faculty,
          },
          statistics: {
            completed: completedReviews.length,
            inProgress: inProgressReviews.length,
            overdue: overdueReviews.length,
            totalAssigned: totalAssigned.length,
          },
          assignedReviews,
          completedReviews,
          inProgressReviews,
          overdueReviews,
        },
      });
    }
  );
}

export default new ReviewerController();
