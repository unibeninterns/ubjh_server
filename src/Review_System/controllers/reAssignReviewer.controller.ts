import { Request, Response } from 'express';
import User, { UserRole, IUser } from '../../model/user.model';
import Manuscript from '../../Manuscript_Submission/models/manuscript.model';
import Review, { ReviewStatus, ReviewType } from '../models/review.model';
import asyncHandler from '../../utils/asyncHandler';
import logger from '../../utils/logger';
import emailService from '../../services/email.service';
import { NotFoundError, BadRequestError } from '../../utils/customErrors';
import { getEligibleFaculties } from '../../utils/facultyClusters';
import mongoose from 'mongoose';

interface IReassignReviewResponse {
  success: boolean;
  message?: string;
  data?: any;
}

class ReassignReviewController {
  reassignReview = asyncHandler(async (req: Request<{reviewId: string}, {}, { assignmentType: 'automatic' | 'manual', newReviewerId?: string }>, res: Response) => {
    const { reviewId } = req.params;
    const { assignmentType, newReviewerId } = req.body;

    const review = await Review.findById(reviewId).populate('manuscript');
    if (!review) {
      throw new NotFoundError('Review not found');
    }

    const manuscript = review.manuscript as any;
    if (!manuscript) {
      throw new NotFoundError('Manuscript not found for this review');
    }

    const oldReviewerId = review.reviewer;
    let newReviewer: IUser | null = null;

    // Remove manuscript from old reviewer's assignedReviews
    const oldReviewer = await User.findById(oldReviewerId);
    if (oldReviewer && oldReviewer.assignedReviews) {
      oldReviewer.assignedReviews = oldReviewer.assignedReviews.filter(
        (id) => !id.equals(manuscript._id)
      );
      await oldReviewer.save();
    }

    if (assignmentType === 'manual') {
        if (!newReviewerId) {
            throw new BadRequestError('New reviewer ID is required for manual reassignment.');
        }
        newReviewer = await User.findById(newReviewerId);
        if (!newReviewer) {
            throw new NotFoundError('New reviewer not found.');
        }
        const newReviewerObjectId = newReviewer._id as mongoose.Types.ObjectId;
        if (review.reviewer.equals(newReviewerObjectId)) {
            throw new BadRequestError('The new reviewer cannot be the same as the old reviewer.');
        }
    } else { // Automatic
        const existingReviewerIds = (await Review.find({ manuscript: manuscript._id })).map(r => r.reviewer);

        const submitter = await User.findById(manuscript.submitter);
        if (!submitter) {
            throw new NotFoundError('Submitter not found');
        }
        const eligibleFaculties = getEligibleFaculties(submitter.assignedFaculty as string);

        const eligibleReviewers = await User.find({
            role: UserRole.REVIEWER,
            isActive: true,
            assignedFaculty: { $in: eligibleFaculties },
            _id: { $nin: existingReviewerIds },
        }).sort({ 'reviews.length': 1 }); // simple workload sort

        if (eligibleReviewers.length === 0) {
            throw new NotFoundError('No eligible reviewers found for automatic reassignment.');
        }
        newReviewer = eligibleReviewers[0];
    }

    if (!newReviewer) {
        throw new NotFoundError('Could not select a new reviewer.');
    }

    review.reviewer = newReviewer._id as mongoose.Types.ObjectId;
    review.status = ReviewStatus.IN_PROGRESS;
    review.dueDate = new Date(Date.now() + 21 * 24 * 60 * 60 * 1000); // 3 weeks

    await review.save();

    // Add manuscript to new reviewer's assignedReviews
    if (newReviewer) {
      if (!newReviewer.assignedReviews) {
        newReviewer.assignedReviews = [];
      }
      newReviewer.assignedReviews.push(manuscript._id as mongoose.Types.ObjectId);
      await newReviewer.save();
    }

    try {
      await emailService.sendReviewAssignmentEmail(
        newReviewer.email,
        manuscript.title,
        newReviewer.name,
        review.dueDate
      );
    } catch (error) {
      logger.error('Failed to send review assignment email:', error);
              }
              res.status(200).json({
                success: true,
                message: 'Review reassigned successfully',
                data: { review, oldReviewerId },
              });
            });
            getEligibleReviewers = asyncHandler(async (req: Request, res: Response) => {
              const { manuscriptId } = req.params;
              const manuscript = await Manuscript.findById(manuscriptId).populate('submitter');
              if (!manuscript) {
                throw new NotFoundError('Manuscript not found');
              }
              const submitter = manuscript.submitter as any;
              const eligibleFaculties = getEligibleFaculties(submitter.assignedFaculty);
              const existingReviewerIds = (await Review.find({ manuscript: manuscriptId
    })).map(r => r.reviewer);
              const eligibleReviewers = await User.find({
                role: UserRole.REVIEWER,
                isActive: true,
                assignedFaculty: { $in: eligibleFaculties },
                _id: { $nin: existingReviewerIds },
              });
              const adminReviewers = await User.find({ role: UserRole.ADMIN, isActive: true, _id: { $nin: existingReviewerIds } });
              res.status(200).json({
              success: true,
              data: [...eligibleReviewers, ...adminReviewers],
            });
          });
              getExistingReviewers = asyncHandler(async (req: Request, res: Response) => {
                const { manuscriptId } = req.params;
                
                const manuscript = await Manuscript.findById(manuscriptId);
                if (!manuscript) {
                    throw new NotFoundError('Manuscript not found');
          }
          const reviews = await Review.find({ manuscript: manuscriptId }).populate(
  'reviewer', 'name email role');
                res.status(200).json({
                    success: true,
                    data: {
                            manuscriptStatus: manuscript.status,
                            reviews: reviews.map(r => ({
                            reviewId: r._id,
                            reviewType: r.reviewType,
                            status: r.status,
                            dueDate: r.dueDate,
                            reviewer: r.reviewer
            }))
        }
      });
    });
}
 export default new ReassignReviewController();  
