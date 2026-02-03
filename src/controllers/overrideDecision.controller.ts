import { Request, Response } from 'express';
import Manuscript from '../Manuscript_Submission/models/manuscript.model';
import { NotFoundError, UnauthorizedError } from '../utils/customErrors';
import asyncHandler from '../utils/asyncHandler';
import logger from '../utils/logger';

interface AdminAuthenticatedRequest extends Request {
  user: {
    id: string;
    role: string;
  };
}

interface OverrideStatusRequest {
  status: string;
  reason: string;
  silentUpdate: boolean;
}

class OverrideDecisionController {
  /**
   * Override manuscript status without any checks or notifications
   * This is a privileged admin-only operation
   */
  overrideStatus = asyncHandler(
    async (req: Request, res: Response): Promise<void> => {
      const user = (req as AdminAuthenticatedRequest).user;

      if (user.role !== 'admin') {
        throw new UnauthorizedError(
          'You do not have permission to override manuscript status'
        );
      }

      const { manuscriptId } = req.params;
      const { status, reason, silentUpdate } =
        req.body as OverrideStatusRequest;

      // Find the manuscript
      const manuscript = await Manuscript.findById(manuscriptId);

      if (!manuscript) {
        throw new NotFoundError('Manuscript not found');
      }

      // Log the override action for audit trail
      logger.warn(
        `ADMIN OVERRIDE: User ${user.id} is overriding manuscript ${manuscriptId} status from ${manuscript.status} to ${status}. Reason: ${reason}. Silent: ${silentUpdate}`
      );

      // Store the old status for logging
      const oldStatus = manuscript.status;

      // Update the status directly without any validation
      manuscript.status = status as any;

      // Add override metadata to the manuscript
      if (!manuscript.reviewComments) {
        manuscript.reviewComments = {};
      }

      // Store override history
      if (!(manuscript as any).overrideHistory) {
        (manuscript as any).overrideHistory = [];
      }

      (manuscript as any).overrideHistory.push({
        adminId: user.id,
        fromStatus: oldStatus,
        toStatus: status,
        reason,
        timestamp: new Date(),
        silentUpdate,
      });

      // Save the manuscript
      await manuscript.save();

      logger.info(
        `Manuscript ${manuscriptId} status overridden from ${oldStatus} to ${status} by admin ${user.id}`
      );

      res.status(200).json({
        success: true,
        message: 'Manuscript status overridden successfully',
        data: {
          manuscriptId: manuscript._id,
          oldStatus,
          newStatus: status,
          overrideBy: user.id,
          reason,
        },
      });
    }
  );

  /**
   * Get override history for a manuscript
   */
  getOverrideHistory = asyncHandler(
    async (req: Request, res: Response): Promise<void> => {
      const user = (req as AdminAuthenticatedRequest).user;

      if (user.role !== 'admin') {
        throw new UnauthorizedError(
          'You do not have permission to view override history'
        );
      }

      const { manuscriptId } = req.params;

      const manuscript = await Manuscript.findById(manuscriptId);

      if (!manuscript) {
        throw new NotFoundError('Manuscript not found');
      }

      const overrideHistory = (manuscript as any).overrideHistory || [];

      res.status(200).json({
        success: true,
        data: {
          manuscriptId: manuscript._id,
          manuscriptTitle: manuscript.title,
          currentStatus: manuscript.status,
          overrideHistory,
        },
      });
    }
  );
}

export default new OverrideDecisionController();
