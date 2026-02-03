import { Request, Response } from 'express';
import User from '../../model/user.model';
import Manuscript from '../../Manuscript_Submission/models/manuscript.model';
import emailService from '../../services/email.service';
import asyncHandler from '../../utils/asyncHandler';
import logger from '../../utils/logger';
import { BadRequestError } from '../../utils/customErrors';

interface AdminAuthenticatedRequest extends Request {
  user: {
    id: string;
    role: string;
  };
}

interface RecipientData {
  userId: string;
  name: string;
  email: string;
  manuscriptTitle?: string;
  manuscriptId?: string;
  manuscriptStatus?: string;
  role: string;
}

interface EmailAttachment {
  filename: string;
  path: string;
  contentType: string;
}

class DynamicEmailController {
  // Get recipients with filtering
  getRecipients = asyncHandler(
    async (req: Request, res: Response): Promise<void> => {
      const { role, manuscriptStatus, search } = req.query;

      const query: any = {};

      // Filter by role
      if (role && role !== 'all') {
        query.role = role;
      }

      // Search by name or email
      if (search) {
        query.$or = [
          { name: { $regex: search, $options: 'i' } },
          { email: { $regex: search, $options: 'i' } },
        ];
      }

      // Get users
      const users = await User.find(query).select('_id name email role').lean();

      // Enrich with manuscript data if filtering by manuscript status
      let recipients: RecipientData[] = [];

      if (manuscriptStatus && manuscriptStatus !== 'all') {
        const manuscripts = await Manuscript.find({
          submitter: { $in: users.map((u) => u._id) },
          status: manuscriptStatus,
          isArchived: false,
        })
          .select('_id title status submitter')
          .populate('submitter', 'name email role')
          .lean();

        recipients = manuscripts.map((m) => ({
          userId: (m.submitter as any)._id.toString(),
          name: (m.submitter as any).name,
          email: (m.submitter as any).email,
          role: (m.submitter as any).role,
          manuscriptTitle: m.title,
          manuscriptId: m._id.toString(),
          manuscriptStatus: m.status,
        }));
      } else {
        // Get latest manuscript for each user
        for (const user of users) {
          const manuscript = await Manuscript.findOne({
            submitter: user._id,
            isArchived: false,
          })
            .select('_id title status')
            .sort({ createdAt: -1 })
            .lean();

          recipients.push({
            userId: user._id.toString(),
            name: user.name,
            email: user.email,
            role: user.role,
            manuscriptTitle: manuscript?.title,
            manuscriptId: manuscript?._id.toString(),
            manuscriptStatus: manuscript?.status,
          });
        }
      }

      res.status(200).json({
        success: true,
        data: recipients,
      });
    }
  );

  // Preview email with dynamic variables
  previewEmail = asyncHandler(
    async (req: Request, res: Response): Promise<void> => {
      let { recipientIds, subject, headerTitle, bodyContent } = req.body;
      const attachments = req.files as Express.Multer.File[] | undefined;

      // Robustly handle recipientIds (could be string or array from FormData)
      let ids: string[] = [];
      if (typeof recipientIds === 'string') {
        try {
          ids = JSON.parse(recipientIds);
        } catch (e) {
          ids = recipientIds.split(',').map((id: string) => id.trim());
        }
      } else if (Array.isArray(recipientIds)) {
        ids = recipientIds;
      }

      if (ids.length === 0) {
        throw new BadRequestError(
          'At least one recipient is required for preview'
        );
      }

      // Get first recipient for preview
      const firstRecipientId = ids[0];
      
      // Ensure it's a valid MongoDB ID format before querying
      if (!firstRecipientId.match(/^[0-9a-fA-F]{24}$/)) {
        throw new BadRequestError(`Invalid recipient ID format: ${firstRecipientId}`);
      }

      const user = await User.findById(firstRecipientId).lean();

      if (!user) {
        throw new BadRequestError('Recipient not found');
      }

      // Get their latest manuscript
      const manuscript = await Manuscript.findOne({
        submitter: firstRecipientId,
        isArchived: false,
      })
        .select('title _id status')
        .sort({ createdAt: -1 })
        .lean();

      const previewData = {
        name: user.name,
        email: user.email,
        role: user.role,
        manuscriptTitle: manuscript?.title || 'N/A',
        manuscriptId: manuscript?._id.toString() || 'N/A',
        manuscriptStatus: manuscript?.status || 'N/A',
      };

      const processedContent = this.replaceVariables(bodyContent, previewData);
      const fullHtml = this.generateEmailHtml(headerTitle, processedContent);

      // Include attachment info in preview
      const attachmentInfo =
        attachments?.map((file) => ({
          filename: file.originalname,
          size: file.size,
          type: file.mimetype,
        })) || [];

      res.status(200).json({
        success: true,
        data: {
          previewHtml: fullHtml,
          previewRecipient: {
            name: user.name,
            email: user.email,
          },
          attachments: attachmentInfo,
        },
      });
    }
  );

  // Send campaign emails
  sendCampaign = asyncHandler(
    async (req: Request, res: Response): Promise<void> => {
      const adminUser = (req as AdminAuthenticatedRequest).user;
      let { recipientIds, subject, headerTitle, bodyContent } = req.body;
      const attachments = req.files as Express.Multer.File[] | undefined;

      // Robustly handle recipientIds (could be string or array from FormData)
      let ids: string[] = [];
      if (typeof recipientIds === 'string') {
        try {
          ids = JSON.parse(recipientIds);
        } catch (e) {
          ids = recipientIds.split(',').map((id: string) => id.trim());
        }
      } else if (Array.isArray(recipientIds)) {
        ids = recipientIds;
      }

      if (ids.length === 0) {
        throw new BadRequestError('At least one recipient is required');
      }

      if (!subject || !bodyContent) {
        throw new BadRequestError('Subject and body content are required');
      }

      // Prepare attachment data for nodemailer
      const emailAttachments: EmailAttachment[] =
        attachments?.map((file) => ({
          filename: file.originalname,
          path: file.path,
          contentType: file.mimetype,
        })) || [];

      // Get all recipients
      const users = await User.find({
        _id: { $in: ids },
      }).lean();

      const results = {
        sent: 0,
        failed: 0,
        errors: [] as string[],
      };

      // Send to each recipient individually
      for (const user of users) {
        try {
          // Get their latest manuscript
          const manuscript = await Manuscript.findOne({
            submitter: user._id,
            isArchived: false,
          })
            .select('title _id status')
            .sort({ createdAt: -1 })
            .lean();

          const recipientData = {
            name: user.name,
            email: user.email,
            role: user.role,
            manuscriptTitle: manuscript?.title || 'N/A',
            manuscriptId: manuscript?._id.toString() || 'N/A',
            manuscriptStatus: manuscript?.status || 'N/A',
          };

          const processedContent = this.replaceVariables(
            bodyContent,
            recipientData
          );
          const fullHtml = this.generateEmailHtml(
            headerTitle,
            processedContent
          );

          await emailService.sendDynamicEmail(
            user.email,
            subject,
            fullHtml,
            emailAttachments
          );
          results.sent++;
        } catch (error) {
          results.failed++;
          results.errors.push(
            `Failed to send to ${user.email}: ${(error as Error).message}`
          );
          logger.error(
            `Failed to send campaign email to ${user.email}:`,
            error
          );
        }
      }

      // Clean up uploaded files after sending
      if (attachments) {
        const fs = await import('fs/promises');
        for (const file of attachments) {
          try {
            await fs.unlink(file.path);
          } catch (error) {
            logger.error(
              `Failed to delete attachment file: ${file.path}`,
              error
            );
          }
        }
      }

      logger.info(
        `Admin ${adminUser.id} sent email campaign to ${results.sent} recipients (${results.failed} failed)${emailAttachments.length > 0 ? ` with ${emailAttachments.length} attachment(s)` : ''}`
      );

      res.status(200).json({
        success: true,
        message: `Email sent to ${results.sent} recipients${results.failed > 0 ? ` (${results.failed} failed)` : ''}`,
        data: results,
      });
    }
  );

  // Helper: Replace dynamic variables
  private replaceVariables(
    template: string,
    data: Record<string, string>
  ): string {
    let result = template;

    // Replace {{variableName}} with actual values
    Object.keys(data).forEach((key) => {
      const regex = new RegExp(`{{${key}}}`, 'g');
      result = result.replace(regex, data[key] || 'N/A');
    });

    return result;
  }

  // Helper: Generate full email HTML with branding
  private generateEmailHtml(headerTitle: string, bodyContent: string): string {
    return `
<!DOCTYPE html>
<html>
<head>
  <style>
    body {
      font-family: system-ui, -apple-system, Segoe UI, Roboto, Arial, sans-serif;
      line-height: 1.55;
      color: #212121;
      max-width: 600px;
      margin: 0 auto;
      padding: 20px;
      background-color: #f9f9f9;
    }
    .header {
      background: #7A0019;
      color: #fff;
      padding: 24px 16px;
      text-align: center;
      border-radius: 8px 8px 0 0;
    }
    .header h1 {
      margin: 0;
      font-size: 24px;
    }
    .content {
      padding: 24px;
      background-color: #ffffff;
      border-radius: 0 0 8px 8px;
      box-shadow: 0 2px 5px rgba(0,0,0,0.1);
    }
    .footer {
      background: #faf7f8;
      padding: 16px;
      font-size: 14px;
      color: #444;
      border-top: 1px solid #ead3d9;
      text-align: center;
      margin-top: 20px;
      border-radius: 8px;
    }
  </style>
</head>
<body>
  <div class="header">
    <h1>${headerTitle}</h1>
  </div>
  <div class="content">
    ${bodyContent}
  </div>
  <div class="footer">
    <p>© ${new Date().getFullYear()} University of Benin — UNIBEN Journal of Humanities</p>
  </div>
</body>
</html>
    `;
  }
}

export default new DynamicEmailController();
