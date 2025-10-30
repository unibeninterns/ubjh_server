import Agenda, { Job } from 'agenda';
import Article from '../Articles/model/article.model';
import FailedJob, { JobType } from '../Publication/models/failedJob.model';
import EmailSubscriber from '../Publication/models/emailSubscriber.model';
import crossrefService from '../Publication/services/crossref.service';
import internetArchiveService from '../Publication/services/internetArchive.service';
import indexingService from '../Publication/services/indexing.service';
import emailService from '../services/email.service';
import logger from '../utils/logger';
import dotenv from 'dotenv';

dotenv.config();

const mongoConnectionString = process.env.MONGODB_URI;

if (!mongoConnectionString) {
  throw new Error('MONGODB_URI environment variable is not set.');
}

const agenda = new Agenda({
  db: { address: mongoConnectionString, collection: 'agendaJobs' },
  processEvery: '30 seconds',
  maxConcurrency: 5,
});

// ==================== PUBLICATION JOBS ====================

// Main publication job - coordinates all sub-jobs
agenda.define(
  'publish-article',
  { priority: 'high', concurrency: 2 },
  async (job: Job<{ articleId: string; pdfPath: string }>) => {
    const { articleId, pdfPath } = job.attrs.data;

    logger.info(`Starting publication process for article ${articleId}`);

    // Schedule DOI registration
    await agenda.now('register-doi', { articleId, pdfPath });

    // Schedule indexing metadata generation
    await agenda.now('generate-indexing-metadata', { articleId });

    // Schedule preservation upload
    await agenda.now('upload-to-archive', { articleId, pdfPath });

    // Schedule email notifications
    await agenda.now('send-publication-notification', { articleId });

    logger.info(`All publication jobs scheduled for article ${articleId}`);
  }
);

// DOI Registration Job
agenda.define(
  'register-doi',
  { priority: 'high', concurrency: 1 },
  async (
    job: Job<{ articleId: string; pdfPath: string; failedJobId?: string }>
  ) => {
    const { articleId, pdfPath, failedJobId } = job.attrs.data;

    try {
      logger.info(`Starting DOI registration for article ${articleId}`);

      const article = await Article.findById(articleId)
        .populate('author', 'name email affiliation orcid')
        .populate('coAuthors', 'name email affiliation orcid')
        .populate('volume')
        .populate('issue');

      if (!article) {
        throw new Error('Article not found');
      }

      if (article.doi) {
        logger.info(`Article ${articleId} already has a DOI: ${article.doi}`);
        return;
      }

      const authors = [article.author, ...(article.coAuthors || [])];
      const volume = article.volume as any;
      const issue = article.issue as any;

      // Register with Crossref (CHANGED FROM ZENODO)
      const { doi, batchId } = await crossrefService.registerDOI(
        article,
        authors,
        volume,
        issue
      );

      // Update article with DOI and Crossref info
      article.doi = doi;
      article.crossrefBatchId = batchId;
      article.crossrefDepositDate = new Date();
      article.crossrefStatus = 'registered';
      await article.save();

      logger.info(`DOI registered for article ${articleId}: ${doi}`);

      // Mark failed job as resolved if this was a retry
      if (failedJobId) {
        const failedJob = await FailedJob.findById(failedJobId);
        if (failedJob) {
          failedJob.resolved = true;
          failedJob.resolvedAt = new Date();
          await failedJob.save();
        }
      }
    } catch (error: any) {
      logger.error(
        `DOI registration failed for article ${articleId}:`,
        error.message
      );

      // Update Crossref status to failed
      try {
        const article = await Article.findById(articleId);
        if (article) {
          article.crossrefStatus = 'failed';
          await article.save();
        }
      } catch (updateError) {
        logger.error('Failed to update article status:', updateError);
      }

      // Create or update failed job record
      if (failedJobId) {
        const failedJob = await FailedJob.findById(failedJobId);
        if (failedJob) {
          failedJob.attemptCount += 1;
          failedJob.lastAttemptAt = new Date();
          failedJob.errorMessage = error.message;
          failedJob.errorStack = error.stack;
          await failedJob.save();
        }
      } else {
        await FailedJob.create({
          jobType: JobType.DOI_REGISTRATION,
          articleId,
          errorMessage: error.message,
          errorStack: error.stack,
          data: { pdfPath },
        });
      }

      throw error;
    }
  }
);

// Indexing Metadata Generation Job
agenda.define(
  'generate-indexing-metadata',
  { priority: 'normal', concurrency: 3 },
  async (job: Job<{ articleId: string; failedJobId?: string }>) => {
    const { articleId, failedJobId } = job.attrs.data;

    try {
      logger.info(`Generating indexing metadata for article ${articleId}`);

      const article = await Article.findById(articleId)
        .populate('author', 'name email affiliation')
        .populate('coAuthors', 'name email affiliation')
        .populate('volume')
        .populate('issue');

      if (!article) {
        throw new Error('Article not found');
      }

      const authors = [article.author, ...(article.coAuthors || [])];
      const volume = article.volume as any;
      const issue = article.issue as any;

      // Generate metadata (these will be served via API endpoints)
      const googleScholarMeta = indexingService.generateGoogleScholarMetaTags(
        article,
        authors,
        volume,
        issue
      );

      const oaipmhRecord = indexingService.generateOAIPMHRecord(
        article,
        authors,
        volume,
        issue
      );

      const jsonld = indexingService.generateJSONLD(
        article,
        authors,
        volume,
        issue
      );

      // Update indexing status
      article.indexingStatus.googleScholar = true;
      article.indexingStatus.base = true;
      article.indexingStatus.core = true;
      await article.save();

      logger.info(`Indexing metadata generated for article ${articleId}`);

      // Mark failed job as resolved if this was a retry
      if (failedJobId) {
        const failedJob = await FailedJob.findById(failedJobId);
        if (failedJob) {
          failedJob.resolved = true;
          failedJob.resolvedAt = new Date();
          await failedJob.save();
        }
      }
    } catch (error: any) {
      logger.error(
        `Indexing metadata generation failed for article ${articleId}:`,
        error.message
      );

      if (failedJobId) {
        const failedJob = await FailedJob.findById(failedJobId);
        if (failedJob) {
          failedJob.attemptCount += 1;
          failedJob.lastAttemptAt = new Date();
          failedJob.errorMessage = error.message;
          failedJob.errorStack = error.stack;
          await failedJob.save();
        }
      } else {
        await FailedJob.create({
          jobType: JobType.INDEXING_METADATA,
          articleId,
          errorMessage: error.message,
          errorStack: error.stack,
        });
      }

      throw error;
    }
  }
);

// Internet Archive Preservation Job
agenda.define(
  'upload-to-archive',
  { priority: 'low', concurrency: 1 },
  async (
    job: Job<{ articleId: string; pdfPath: string; failedJobId?: string }>
  ) => {
    const { articleId, pdfPath, failedJobId } = job.attrs.data;

    try {
      logger.info(`Uploading article ${articleId} to Internet Archive`);

      const article = await Article.findById(articleId)
        .populate('author', 'name affiliation')
        .populate('coAuthors', 'name affiliation');

      if (!article) {
        throw new Error('Article not found');
      }

      const authors = [article.author, ...(article.coAuthors || [])];

      // Upload to Internet Archive
      const archiveUrl = await internetArchiveService.uploadArticle(
        article,
        authors,
        pdfPath
      );

      // Update indexing status
      article.indexingStatus.internetArchive = true;
      await article.save();

      logger.info(
        `Article ${articleId} uploaded to Internet Archive: ${archiveUrl}`
      );

      // Mark failed job as resolved if this was a retry
      if (failedJobId) {
        const failedJob = await FailedJob.findById(failedJobId);
        if (failedJob) {
          failedJob.resolved = true;
          failedJob.resolvedAt = new Date();
          await failedJob.save();
        }
      }
    } catch (error: any) {
      logger.error(
        `Internet Archive upload failed for article ${articleId}:`,
        error.message
      );

      if (failedJobId) {
        const failedJob = await FailedJob.findById(failedJobId);
        if (failedJob) {
          failedJob.attemptCount += 1;
          failedJob.lastAttemptAt = new Date();
          failedJob.errorMessage = error.message;
          failedJob.errorStack = error.stack;
          await failedJob.save();
        }
      } else {
        await FailedJob.create({
          jobType: JobType.PRESERVATION,
          articleId,
          errorMessage: error.message,
          errorStack: error.stack,
          data: { pdfPath },
        });
      }

      throw error;
    }
  }
);

// Email Notification Job
agenda.define(
  'send-publication-notification',
  { priority: 'normal', concurrency: 2 },
  async (job: Job<{ articleId: string; failedJobId?: string }>) => {
    const { articleId, failedJobId } = job.attrs.data;

    try {
      logger.info(`Sending publication notifications for article ${articleId}`);

      const article = await Article.findById(articleId)
        .populate('author', 'name')
        .populate('volume', 'volumeNumber')
        .populate('issue', 'issueNumber');

      if (!article) {
        throw new Error('Article not found');
      }

      // Get all active subscribers
      const subscribers = await EmailSubscriber.find({ isActive: true });

      // Send notification emails in batches
      const batchSize = 50;
      for (let i = 0; i < subscribers.length; i += batchSize) {
        const batch = subscribers.slice(i, i + batchSize);

        await Promise.all(
          batch.map(async (subscriber) => {
            try {
              await emailService.sendNewArticleNotification(
                subscriber.email,
                article.title,
                (article.author as any).name,
                article._id.toString(),
                subscriber.unsubscribeToken || ''
              );

              subscriber.lastEmailSent = new Date();
              await subscriber.save();
            } catch (error) {
              logger.error(
                `Failed to send notification to ${subscriber.email}:`,
                error
              );
            }
          })
        );

        // Small delay between batches to avoid rate limiting
        await new Promise((resolve) => setTimeout(resolve, 1000));
      }

      logger.info(
        `Publication notifications sent for article ${articleId} to ${subscribers.length} subscribers`
      );

      // Mark failed job as resolved if this was a retry
      if (failedJobId) {
        const failedJob = await FailedJob.findById(failedJobId);
        if (failedJob) {
          failedJob.resolved = true;
          failedJob.resolvedAt = new Date();
          await failedJob.save();
        }
      }
    } catch (error: any) {
      logger.error(
        `Email notification failed for article ${articleId}:`,
        error.message
      );

      if (failedJobId) {
        const failedJob = await FailedJob.findById(failedJobId);
        if (failedJob) {
          failedJob.attemptCount += 1;
          failedJob.lastAttemptAt = new Date();
          failedJob.errorMessage = error.message;
          failedJob.errorStack = error.stack;
          await failedJob.save();
        }
      } else {
        await FailedJob.create({
          jobType: JobType.EMAIL_NOTIFICATION,
          articleId,
          errorMessage: error.message,
          errorStack: error.stack,
        });
      }

      throw error;
    }
  }
);

export default agenda;
