import nodemailer, { Transporter } from 'nodemailer';
import logger from '../utils/logger';
import validateEnv from '../utils/validateEnv';
import { ManuscriptStatus } from '../Manuscript_Submission/models/manuscript.model';
import {
  reviewReminderTemplate,
  overdueReviewTemplate,
  reconciliationAssignmentTemplate,
  reviewAssignmentTemplate,
  manuscriptNotificationTemplate,
  submissionConfirmationTemplate,
  statusUpdateTemplate,
  reviewerInvitationTemplate,
  reviewerCredentialsTemplate,
  invitationTemplate,
  credentialsTemplate,
  aiReviewFailureTemplate,
  manuscriptStatusUpdateTemplate,
  proposalArchiveNotificationTemplate,
} from '../templates/emails';

validateEnv();

class EmailService {
  private transporter: Transporter;
  private frontendUrl: string;
  private emailFrom: string;

  constructor() {
    if (
      !process.env.SMTP_HOST ||
      !process.env.SMTP_USER ||
      !process.env.SMTP_PASS
    ) {
      throw new Error(
        'SMTP configuration must be defined in environment variables'
      );
    }

    this.transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: parseInt(process.env.SMTP_PORT || '465'),
      secure: true,
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS,
      },
    });

    this.frontendUrl = process.env.FRONTEND_URL || '';
    this.emailFrom = process.env.EMAIL_FROM || '';

    if (!this.frontendUrl || !this.emailFrom) {
      throw new Error(
        'FRONTEND_URL and EMAIL_FROM must be defined in environment variables'
      );
    }
  }

  private getManuscriptStatusUpdateSubject(
    status: ManuscriptStatus,
    manuscriptTitle: string
  ): string {
    if (status === ManuscriptStatus.APPROVED) {
      return `Congratulations! Your Manuscript "${manuscriptTitle}" Has Been Accepted`;
    } else if (status === ManuscriptStatus.REJECTED) {
      return `Update on Your Manuscript Submission: Decision Made for "${manuscriptTitle}"`;
    } else {
      return `Update on your Manuscript Submission: ${manuscriptTitle}`;
    }
  }

  async sendSubmissionConfirmationEmail(
    to: string,
    name: string,
    manuscriptTitle: string,
    isRevision = false
  ): Promise<void> {
    const subject = isRevision
      ? 'Confirmation of Manuscript Revision'
      : 'Confirmation of Manuscript Submission';
    const loginUrl = `${this.frontendUrl}/login`;

    try {
      await this.transporter.sendMail({
        from: this.emailFrom,
        to,
        subject,
        html: submissionConfirmationTemplate(
          name,
          manuscriptTitle,
          loginUrl,
          isRevision
        ),
      });
      logger.info(`Submission confirmation email sent to: ${to}`);
    } catch (error) {
      logger.error(
        'Failed to send submission confirmation email:',
        error instanceof Error ? error.message : 'Unknown error'
      );
      throw error; // Re-throw the error to be caught by the controller
    }
  }

  async sendManuscriptStatusUpdateEmail(
    to: string,
    name: string,
    projectTitle: string,
    status: ManuscriptStatus,
    feedbackComments?: string
  ): Promise<void> {
    try {
      await this.transporter.sendMail({
        from: this.emailFrom,
        to: to,
        subject: this.getManuscriptStatusUpdateSubject(status, projectTitle),
        html: manuscriptStatusUpdateTemplate(
          name,
          projectTitle,
          status,
          undefined,
          feedbackComments
        ),
      });
      logger.info(
        `Manuscript status update email sent to: ${to} for manuscript ${projectTitle}`
      );
    } catch (error) {
      logger.error(
        `Failed to send manuscript status update email to ${to} for manuscript ${projectTitle}:`,
        error instanceof Error ? error.message : 'Unknown error'
      );
      throw error;
    }
  }

  async sendReviewAssignmentEmail(
    email: string,
    manuscriptTitle: string,
    authorName: string,
    dueDate: Date
  ): Promise<void> {
    const reviewUrl = `${this.frontendUrl}/reviewers/assignments`;

    try {
      await this.transporter.sendMail({
        from: this.emailFrom,
        to: email,
        subject: 'New Manuscript Assignment',
        html: reviewAssignmentTemplate(
          manuscriptTitle,
          authorName,
          reviewUrl,
          dueDate
        ),
      });
      logger.info(`Review assignment email sent to reviewer: ${email}`);
    } catch (error) {
      logger.error(
        'Failed to send review assignment email:',
        error instanceof Error ? error.message : 'Unknown error'
      );
    }
  }

  async sendOverdueReviewNotification(
    email: string,
    reviewerName: string,
    manuscriptTitle: string,
    reminderType: '3_WEEKS' | '4_WEEKS' | '5_WEEKS'
  ): Promise<void> {
    const reviewUrl = `${this.frontendUrl}/reviewers/dashboard`;

    try {
      await this.transporter.sendMail({
        from: this.emailFrom,
        to: email,
        subject: 'OVERDUE: Manuscript Review',
        html: overdueReviewTemplate(reviewerName, manuscriptTitle, reviewUrl, reminderType),
      });
      logger.info(`Overdue review notification sent to: ${email}`);
    } catch (error) {
      logger.error(
        'Failed to send overdue review notification:',
        error instanceof Error ? error.message : 'Unknown error'
      );
    }
  }

  async sendReconciliationAssignmentEmail(
    email: string,
    reviewerName: string,
    manuscriptTitle: string,
    dueDate: Date
  ): Promise<void> {
    const reviewUrl = `${this.frontendUrl}/reviewers/dashboard`;

    try {
      await this.transporter.sendMail({
        from: this.emailFrom,
        to: email,
        subject: 'Reconciliation Review Assignment',
        html: reconciliationAssignmentTemplate(
          reviewerName,
          manuscriptTitle,
          reviewUrl,
          dueDate
        ),
      });
      logger.info(`Reconciliation assignment email sent to: ${email}`);
    } catch (error) {
      logger.error(
        'Failed to send reconciliation assignment email:',
        error instanceof Error ? error.message : 'Unknown error'
      );
    }
  }
}

export default new EmailService();
