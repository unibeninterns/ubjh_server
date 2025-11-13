/* eslint-disable max-lines */
import { Request, Response } from 'express';
import Manuscript, { ManuscriptStatus } from '../Manuscript_Submission/models/manuscript.model';
import { NotFoundError, UnauthorizedError } from '../utils/customErrors';
import asyncHandler from '../utils/asyncHandler';
import logger from '../utils/logger';
import User from '../model/user.model';
import Review from '../Review_System/models/review.model';
import emailService from '../services/email.service';
import {
  getFacultyDepartmentData,
  isFacultyInCluster,
} from '../utils/facultyClusters';
import { PipelineStage } from 'mongoose';

interface IManuscriptQuery {
  status?: string;
}

interface IPaginationOptions {
  page: number;
  limit: number;
  sort: Record<string, 1 | -1>;
}

interface IManuscriptResponse {
  success: boolean;
  count?: number;
  totalPages?: number;
  currentPage?: number;
  message?: string;
  data?: any;
}

interface IStatisticsResponse {
  success: boolean;
  data: {
    total: number;
    byStatus: Record<string, number>;
  };
}

interface AdminAuthenticatedRequest extends Request {
  user: {
    id: string;
    role: string;
  };
}

class AdminController {
  // Get all manuscripts with pagination and filtering
  getAllManuscripts = asyncHandler(
    async (req: Request, res: Response<IManuscriptResponse>): Promise<void> => {
      const user = (req as AdminAuthenticatedRequest).user;
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

      const query: IManuscriptQuery = {};
      if (status) query.status = status as string;

      const sortObj: Record<string, 1 | -1> = {};
      if (sort !== 'duplicates') {
        sortObj[sort as string] = order === 'asc' ? 1 : -1;
      }

      const options: IPaginationOptions = {
        page: parseInt(page as string, 10),
        limit: parseInt(limit as string, 10),
        sort: sortObj,
      };

      const reviewProcessCompletedStage = {
        $addFields: {
          isReviewProcessCompleted: {
            $or: [
              {
                $anyElementTrue: [
                  {
                    $map: {
                      input: '$reviews',
                      as: 'review',
                      in: {
                        $and: [
                          { $eq: ['$$review.reviewType', 'reconciliation'] },
                          { $eq: ['$$review.status', 'completed'] },
                        ],
                      },
                    },
                  },
                ],
              },
              {
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
                    $and: [
                      { $eq: [{ $size: '$$humanReviews' }, 2] },
                      {
                        $eq: [
                          { $arrayElemAt: ['$$humanReviews.reviewDecision', 0] },
                          { $arrayElemAt: ['$$humanReviews.reviewDecision', 1] },
                        ],
                      },
                    ],
                  },
                },
              },
            ],
          },
        },
      };

      let pipeline: PipelineStage[] = [];
      let countPipeline: PipelineStage[] = [];

      if (sort === 'duplicates') {
        const duplicateSubmitters = await Manuscript.aggregate([
          { $match: query },
          { $group: { _id: '$submitter', count: { $sum: 1 } } },
          { $match: { count: { $gt: 1 } } },
          { $project: { submitter: '$_id' } },
        ]);

        const duplicateSubmitterIds = duplicateSubmitters.map(
          (item) => item.submitter
        );

        if (duplicateSubmitterIds.length === 0) {
          res.status(200).json({
            success: true,
            count: 0,
            totalPages: 0,
            currentPage: options.page,
            data: [],
          });
          return;
        }

        const matchStage = {
          $match: { ...query, submitter: { $in: duplicateSubmitterIds } },
        };
        pipeline = [
          matchStage,
          {
            $lookup: {
              from: 'Users',
              localField: 'submitter',
              foreignField: '_id',
              as: 'submitterData',
            },
          },
          { $unwind: '$submitterData' },
          {
            $lookup: {
              from: 'Reviews',
              localField: '_id',
              foreignField: 'manuscript',
              as: 'reviews',
            },
          },
          reviewProcessCompletedStage,
          {
            $sort: {
              'submitterData.name': order === 'asc' ? 1 : -1,
              createdAt: -1,
            },
          },
          { $skip: (options.page - 1) * options.limit },
          { $limit: options.limit },
          {
            $project: {
              _id: 1,
              title: 1,
              status: 1,
              createdAt: 1,
              submitter: {
                _id: '$submitterData._id',
                name: '$submitterData.name',
                email: '$submitterData.email',
                assignedFaculty: '$submitterData.assignedFaculty',
              },
              assignedReviewerCount: { $size: '$reviews' },
              isReviewProcessCompleted: 1,
              originPdfFile: 1,
              originRevisedPdfFile: 1,
            },
          },
        ];
        countPipeline = [matchStage, { $count: 'total' }];
      } else {
        const matchStage: PipelineStage.Match = { $match: query };
        if (faculty) {
          matchStage.$match['submitterData.assignedFaculty'] = faculty;
        }

        pipeline = [
          {
            $lookup: {
              from: 'Users',
              localField: 'submitter',
              foreignField: '_id',
              as: 'submitterData',
            },
          },
          { $unwind: '$submitterData' },
          {
            $lookup: {
              from: 'Reviews',
              localField: '_id',
              foreignField: 'manuscript',
              as: 'reviews',
            },
          },
          reviewProcessCompletedStage,
          matchStage,
          { $sort: sortObj },
          { $skip: (options.page - 1) * options.limit },
          { $limit: options.limit },
          {
            $project: {
              _id: 1,
              title: 1,
              status: 1,
              createdAt: 1,
              updatedAt: 1,
              revisedPdfFile: 1,
              revisionType: 1,
              submitter: {
                _id: '$submitterData._id',
                name: '$submitterData.name',
                email: '$submitterData.email',
                assignedFaculty: '$submitterData.assignedFaculty',
              },
              assignedReviewerCount: { $size: '$reviews' },
              isReviewProcessCompleted: 1,
              originPdfFile: 1,
              originRevisedPdfFile: 1,
            },
          },
        ];

        countPipeline = [
          {
            $lookup: {
              from: 'Users',
              localField: 'submitter',
              foreignField: '_id',
              as: 'submitterData',
            },
          },
          { $unwind: '$submitterData' },
          matchStage,
          { $count: 'total' },
        ];
      }

      const manuscripts = await Manuscript.aggregate(pipeline);
      const totalResult = await Manuscript.aggregate(countPipeline);
      const totalManuscripts = totalResult[0]?.total || 0;

      logger.info(
        `Admin ${user.id} retrieved manuscripts list with filters: ${JSON.stringify(
          req.query
        )}`
      );

      res.status(200).json({
        success: true,
        count: manuscripts.length,
        totalPages: Math.ceil(totalManuscripts / options.limit),
        currentPage: options.page,
        data: manuscripts,
      });
    }
  );

  // Get manuscript by ID
  getManuscriptById = asyncHandler(
    async (req: Request, res: Response<IManuscriptResponse>): Promise<void> => {
      const user = (req as AdminAuthenticatedRequest).user;
      if (user.role !== 'admin') {
        throw new UnauthorizedError(
          'You do not have permission to access this resource'
        );
      }

      const { id } = req.params;

      const manuscript = await Manuscript.findById(id).populate(
        'submitter coAuthors',
        'name email assignedFaculty faculty institution'
      );

      if (!manuscript) {
        throw new NotFoundError('Manuscript not found');
      }

      logger.info(`Admin ${user.id} retrieved manuscript ${id}`);

      res.status(200).json({
        success: true,
        data: manuscript,
      });
    }
  );

  // Get manuscript statistics
  getManuscriptStatistics = asyncHandler(
    async (req: Request, res: Response<IStatisticsResponse>): Promise<void> => {
      const user = (req as AdminAuthenticatedRequest).user;
      if (user.role !== 'admin') {
        throw new UnauthorizedError(
          'You do not have permission to access this resource'
        );
      }

      const totalManuscripts = await Manuscript.countDocuments();

      const statusCounts = await Manuscript.aggregate([
        { $group: { _id: '$status', count: { $sum: 1 } } },
      ]);

      const statusStats: Record<string, number> = {};
      statusCounts.forEach((item) => {
        statusStats[item._id] = item.count;
      });

      logger.info(`Admin ${user.id} retrieved manuscript statistics`);

      res.status(200).json({
        success: true,
        data: {
          total: totalManuscripts,
          byStatus: statusStats,
        },
      });
    }
  );

  // Get all faculty and department data for admin UI
  getFacultyData = asyncHandler(
    async (req: Request, res: Response): Promise<void> => {
      const user = (req as AdminAuthenticatedRequest).user;
      if (user.role !== 'admin') {
        throw new UnauthorizedError(
          'You do not have permission to access this resource'
        );
      }

      const facultyData = getFacultyDepartmentData();

      res.status(200).json({
        success: true,
        data: facultyData,
      });
    }
  );

  editManuscript = asyncHandler(
    async (req: Request, res: Response): Promise<void> => {
      const user = (req as AdminAuthenticatedRequest).user;
      if (user.role !== 'admin') {
        throw new UnauthorizedError(
          'You do not have permission to access this resource'
        );
      }

      const { id } = req.params;
      const manuscript = await Manuscript.findById(id);

      if (!manuscript) {
        throw new NotFoundError('Manuscript not found');
      }

      if (!req.file) {
        res.status(400).json({
          success: false,
          message: 'No file uploaded.',
        });
        return;
      }

      // Move the old file path to originPdfFile and update the pdfFile with the new path
      manuscript.originPdfFile = manuscript.pdfFile;
      const pdfFile = `${
        process.env.API_URL || 'http://localhost:3000'
      }/uploads/documents/${req.file.filename}`;
      manuscript.pdfFile = pdfFile;

      await manuscript.save();

      logger.info(`Admin ${user.id} edited manuscript ${id}`);

      res.status(200).json({
        success: true,
        message: 'Manuscript edited successfully.',
        data: manuscript,
      });
    }
  );

  // Assign a faculty to a user or a manuscript's submitter
  assignFaculty = asyncHandler(
    async (req: Request, res: Response): Promise<void> => {
      const adminUser = (req as AdminAuthenticatedRequest).user;
      if (adminUser.role !== 'admin') {
        throw new UnauthorizedError(
          'You do not have permission to access this resource'
        );
      }

      const { faculty, userId, manuscriptId } = req.body;

      if (!faculty || (!userId && !manuscriptId)) {
        res.status(400).json({
          success: false,
          message: 'Faculty and either userId or manuscriptId are required.',
        });
        return;
      }

      // Validate if the provided faculty is a real one
      if (!isFacultyInCluster(faculty)) {
        res.status(400).json({
          success: false,
          message: `Faculty '${faculty}' is not a valid faculty.`,
        });
        return;
      }

      let userToUpdate;

      if (userId) {
        userToUpdate = await User.findById(userId);
      } else if (manuscriptId) {
        const manuscript = await Manuscript.findById(manuscriptId);
        if (manuscript) {
          // find user by submitter id
          userToUpdate = await User.findById(manuscript.submitter);
        }
      }

      if (!userToUpdate) {
        throw new NotFoundError('User or Manuscript not found');
      }

      userToUpdate.assignedFaculty = faculty;
      await userToUpdate.save();

      logger.info(
        `Admin ${adminUser.id} assigned faculty '${faculty}' to user ${userToUpdate._id}`
      );

      res.status(200).json({
        success: true,
        message: `Successfully assigned faculty to user ${userToUpdate.name}.`,
        data: {
          userId: userToUpdate._id,
          assignedFaculty: userToUpdate.assignedFaculty,
        },
      });
    }
  );

  getFacultiesWithManuscripts = asyncHandler(
    async (req: Request, res: Response): Promise<void> => {
      const user = (req as AdminAuthenticatedRequest).user;
      if (user.role !== 'admin') {
        throw new UnauthorizedError(
          'You do not have permission to access this resource'
        );
      }

      logger.info(`Admin ${user.id} retrieving faculties with manuscripts`);

      try {
        // Get all submitters who have created manuscripts
        const manuscriptSubmitters =
          await Manuscript.find().distinct('submitter');

        // Find users who submitted manuscripts and get their distinct assigned faculties
        const assignedFaculties = await User.find({
          _id: { $in: manuscriptSubmitters },
          assignedFaculty: { $exists: true, $ne: null },
        }).distinct('assignedFaculty');

        logger.info(
          `Found ${assignedFaculties.length} distinct assigned faculties with manuscripts`
        );

        // Get the full faculty-department data
        const allFacultyData = getFacultyDepartmentData();

        // Filter the full data to only include faculties that have manuscripts
        const detailedFaculties = assignedFaculties.map((facultyName) => {
          return {
            faculty: facultyName,
            departments: allFacultyData[facultyName] || [],
          };
        });

        res.status(200).json({
          success: true,
          data: detailedFaculties,
        });
      } catch (error) {
        logger.error(`Error retrieving faculties with manuscripts: ${error}`);
        res.status(500).json({
          success: false,
          message: 'Failed to retrieve faculties with manuscripts',
        });
      }
    }
  );

  editRevisedManuscript = asyncHandler(
    async (req: Request, res: Response): Promise<void> => {
      const { id } = req.params;

      if (!req.file) {
        res.status(400).json({
          success: false,
          message: 'Manuscript PDF file is required.',
        });
        return;
      }

      const manuscript = await Manuscript.findById(id).populate('submitter');
      if (!manuscript) {
        throw new NotFoundError('Manuscript not found');
      }

      // Move the old revised file path to originRevisedPdfFile
      if (manuscript.revisedPdfFile) {
        manuscript.originRevisedPdfFile = manuscript.revisedPdfFile;
      }

      const pdfFile = `${
        process.env.API_URL || 'http://localhost:3000'
      }/uploads/documents/${req.file.filename}`;

      manuscript.revisedPdfFile = pdfFile;

      // Reset status to under_review for re-review
      const isMinorRevision = manuscript.revisionType === 'minor';
      manuscript.status = ManuscriptStatus.UNDER_REVIEW;

      await manuscript.save();

      // Auto-assign based on revision type
      if (isMinorRevision) {
        // Assign to admin for minor revision
        const admin = await User.findOne({
          role: 'admin',
          isActive: true,
        });
        if (admin) {
          const dueDate = new Date(Date.now() + 21 * 24 * 60 * 60 * 1000);
          const review = new Review({
            manuscript: manuscript._id,
            reviewer: admin._id,
            reviewType: 'human',
            status: 'in_progress',
            dueDate,
          });
          await review.save();

          try {
            await emailService.sendReviewAssignmentEmail(
              admin.email,
              manuscript.title,
              (manuscript.submitter as any).name,
              dueDate
            );
          } catch (error) {
            logger.error(
              'Failed to send admin review assignment email:',
              error
            );
          }
        }
      } else if (manuscript.originalReviewer) {
        // Assign to original reviewer for major revision
        const dueDate = new Date(Date.now() + 21 * 24 * 60 * 60 * 1000);
        const review = new Review({
          manuscript: manuscript._id,
          reviewer: manuscript.originalReviewer,
          reviewType: 'human',
          status: 'in_progress',
          dueDate,
        });
        await review.save();

        const reviewer = await User.findById(
          manuscript.originalReviewer
        );
        if (reviewer) {
          try {
            await emailService.sendReviewAssignmentEmail(
              reviewer.email,
              manuscript.title,
              (manuscript.submitter as any).name,
              dueDate
            );
          } catch (error) {
            logger.error('Failed to send reviewer assignment email:', error);
          }
        }
      }

      logger.info(`Revised manuscript ${id} has been edited and re-assigned.`);

      res.status(200).json({
        success: true,
        message: 'Manuscript edited successfully and assigned for review.',
        data: {
          manuscriptId: (manuscript._id as any).toString(),
        },
      });
    }
  );
}

export default new AdminController();
