import { Request, Response } from 'express';
import Manuscript from '../Manuscript_Submission/models/manuscript.model';
import { NotFoundError, UnauthorizedError } from '../utils/customErrors';
import asyncHandler from '../utils/asyncHandler';
import logger from '../utils/logger';
import User from '../model/user.model';
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

      const query: IManuscriptQuery = {};

      // Apply filters if provided
      if (status) query.status = status as string;

      // Handle duplicates sorting - when sort is 'duplicates'
      if (sort === 'duplicates') {
        // Find submitters who have more than one manuscript
        const duplicateSubmitters = await Manuscript.aggregate([
          { $match: query }, // Apply existing filters first
          { $group: { _id: '$submitter', count: { $sum: 1 } } },
          { $match: { count: { $gt: 1 } } },
          { $project: { submitter: '$_id' } },
        ]);

        const duplicateSubmitterIds = duplicateSubmitters.map(
          (item) => item.submitter
        );

        if (duplicateSubmitterIds.length === 0) {
          // No duplicates found, return empty result
          logger.info(
            `Admin ${user.id} retrieved manuscripts list - no duplicates found`
          );
          res.status(200).json({
            success: true,
            count: 0,
            totalPages: 0,
            currentPage: parseInt(page as string, 10),
            data: [],
          });
          return;
        }

        // Build aggregation pipeline for grouped results by submitter
        const pipeline = [
          {
            $match: {
              ...query,
              submitter: { $in: duplicateSubmitterIds },
            },
          },
          {
            $lookup: {
              from: 'Users',
              localField: 'submitter',
              foreignField: '_id',
              as: 'submitterData',
            },
          },
          {
            $unwind: '$submitterData',
          },
          {
            $sort: {
              'submitterData.name': order === 'asc' ? 1 : -1,
              createdAt: -1,
            },
          },
          {
            $skip:
              (parseInt(page as string, 10) - 1) *
              parseInt(limit as string, 10),
          },
          {
            $limit: parseInt(limit as string, 10),
          },
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
            },
          },
        ];

        const manuscripts = await Manuscript.aggregate(
          pipeline as PipelineStage[]
        );

        const totalManuscripts = await Manuscript.countDocuments({
          ...query,
          submitter: { $in: duplicateSubmitterIds },
        });

        logger.info(
          `Admin ${user.id} retrieved manuscripts list sorted by duplicates`
        );

        res.status(200).json({
          success: true,
          count: manuscripts.length,
          totalPages: Math.ceil(
            totalManuscripts / parseInt(limit as string, 10)
          ),
          currentPage: parseInt(page as string, 10),
          data: manuscripts,
        });
        return;
      }

      const sortObj: Record<string, 1 | -1> = {};
      sortObj[sort as string] = order === 'asc' ? 1 : -1;

      const options: IPaginationOptions = {
        page: parseInt(page as string, 10),
        limit: parseInt(limit as string, 10),
        sort: sortObj,
      };

      let manuscripts;

      if (faculty) {
        const usersWithFaculty = await User.find({
          faculty: faculty as string,
        }).select('_id');
        const userIds = usersWithFaculty.map((user) => user._id);

        manuscripts = await Manuscript.find({
          ...query,
          submitter: { $in: userIds },
        })
          .sort(sortObj)
          .skip((options.page - 1) * options.limit)
          .limit(options.limit)
          .populate('submitter', 'name email assignedFaculty');

        const totalManuscripts = await Manuscript.countDocuments({
          ...query,
          submitter: { $in: userIds },
        });

        logger.info(
          `Admin ${user.id} retrieved manuscripts list filtered by faculty`
        );

        res.status(200).json({
          success: true,
          count: manuscripts.length,
          totalPages: Math.ceil(totalManuscripts / options.limit),
          currentPage: options.page,
          data: manuscripts,
        });
      } else {
        manuscripts = await Manuscript.find(query)
          .sort(sortObj)
          .skip((options.page - 1) * options.limit)
          .limit(options.limit)
          .populate('submitter', 'name email assignedFaculty');

        const totalManuscripts = await Manuscript.countDocuments(query);

        logger.info(`Admin ${user.id} retrieved manuscripts list`);

        res.status(200).json({
          success: true,
          count: manuscripts.length,
          totalPages: Math.ceil(totalManuscripts / options.limit),
          currentPage: options.page,
          data: manuscripts,
        });
      }
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
}

export default new AdminController();
