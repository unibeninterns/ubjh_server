import { Request, Response } from 'express';
import Article from '../model/article.model';
import { NotFoundError } from '../../utils/customErrors';
import asyncHandler from '../../utils/asyncHandler';
import logger from '../../utils/logger';

class ArticleAnalyticsController {
  recordView = asyncHandler(
    async (req: Request, res: Response): Promise<void> => {
      const { id } = req.params;
      const xForwardedFor = req.headers['x-forwarded-for'];
      const visitorIdentifier =
        req.ip ||
        (Array.isArray(xForwardedFor) ? xForwardedFor[0] : xForwardedFor) ||
        'unknown';

      const article = await Article.findOne({ _id: id, isPublished: true });

      if (!article) {
        throw new NotFoundError('Article not found');
      }

      // Check if viewer already viewed in last 24 hours
      const lastDay = new Date(Date.now() - 24 * 60 * 60 * 1000);
      const existingView = article.views.viewers.find(
        (viewer) =>
          viewer.identifier === visitorIdentifier && viewer.timestamp > lastDay
      );

      if (!existingView) {
        article.views.count += 1;
        article.views.viewers.push({
          identifier: visitorIdentifier,
          timestamp: new Date(),
        });

        // Keep only last 1000 viewers
        if (article.views.viewers.length > 1000) {
          article.views.viewers = article.views.viewers.slice(-1000);
        }

        await article.save();
        logger.info(
          `Recorded view for article ${id} from ${visitorIdentifier}`
        );
      }

      res.status(200).json({
        success: true,
        views: article.views.count,
      });
    }
  );

  // Record article download
  recordDownload = asyncHandler(
    async (req: Request, res: Response): Promise<void> => {
      const { id } = req.params;
      const xForwardedFor = req.headers['x-forwarded-for'];
      const visitorIdentifier =
        req.ip ||
        (Array.isArray(xForwardedFor) ? xForwardedFor[0] : xForwardedFor) ||
        'unknown';

      const article = await Article.findOne({ _id: id, isPublished: true });

      if (!article) {
        throw new NotFoundError('Article not found');
      }

      // Record download (no 24hr restriction for downloads)
      article.downloads.count += 1;
      article.downloads.downloaders.push({
        identifier: visitorIdentifier,
        timestamp: new Date(),
      });

      // Keep only last 1000 download records
      if (article.downloads.downloaders.length > 1000) {
        article.downloads.downloaders =
          article.downloads.downloaders.slice(-1000);
      }

      await article.save();
      logger.info(
        `Recorded download for article ${id} from ${visitorIdentifier}`
      );

      res.status(200).json({
        success: true,
        downloads: article.downloads.count,
      });
    }
  );

  // Get article analytics (views, downloads, citations)
  getArticleAnalytics = asyncHandler(
    async (req: Request, res: Response): Promise<void> => {
      const { id } = req.params;
      const { period = '30' } = req.query; // days

      const article = await Article.findOne({ _id: id, isPublished: true });

      if (!article) {
        throw new NotFoundError('Article not found');
      }

      const daysAgo = parseInt(period as string);
      const startDate = new Date(Date.now() - daysAgo * 24 * 60 * 60 * 1000);

      // Filter recent views/downloads
      const recentViews = article.views.viewers.filter(
        (v) => v.timestamp >= startDate
      );
      const recentDownloads = article.downloads.downloaders.filter(
        (d) => d.timestamp >= startDate
      );

      // Group by date
      const viewsByDate: { [key: string]: number } = {};
      const downloadsByDate: { [key: string]: number } = {};

      recentViews.forEach((view) => {
        const dateKey = view.timestamp.toISOString().split('T')[0];
        viewsByDate[dateKey] = (viewsByDate[dateKey] || 0) + 1;
      });

      recentDownloads.forEach((download) => {
        const dateKey = download.timestamp.toISOString().split('T')[0];
        downloadsByDate[dateKey] = (downloadsByDate[dateKey] || 0) + 1;
      });

      // Convert to arrays
      const viewsTimeSeries = Object.entries(viewsByDate)
        .map(([date, count]) => ({ date, count }))
        .sort((a, b) => a.date.localeCompare(b.date));

      const downloadsTimeSeries = Object.entries(downloadsByDate)
        .map(([date, count]) => ({ date, count }))
        .sort((a, b) => a.date.localeCompare(b.date));

      res.status(200).json({
        success: true,
        data: {
          totalViews: article.views.count,
          totalDownloads: article.downloads.count,
          totalCitations: article.citationCount,
          periodViews: recentViews.length,
          periodDownloads: recentDownloads.length,
          viewsTimeSeries,
          downloadsTimeSeries,
        },
      });
    }
  );

  // Get popular articles
  getPopularArticles = asyncHandler(
    async (req: Request, res: Response): Promise<void> => {
      const { limit = 10, period = 'all', sortBy = 'views' } = req.query;

      let query: any = { isPublished: true };

      // Filter by period if specified
      if (period !== 'all') {
        let dateFilter = new Date();
        switch (period) {
          case 'day':
            dateFilter.setDate(dateFilter.getDate() - 1);
            break;
          case 'week':
            dateFilter.setDate(dateFilter.getDate() - 7);
            break;
          case 'month':
            dateFilter.setMonth(dateFilter.getMonth() - 1);
            break;
          case 'year':
            dateFilter.setFullYear(dateFilter.getFullYear() - 1);
            break;
        }
        query.publishDate = { $gte: dateFilter };
      }

      // Sort by metric
      let sortField = {};
      switch (sortBy) {
        case 'downloads':
          sortField = { 'downloads.count': -1 };
          break;
        case 'citations':
          sortField = { citationCount: -1 };
          break;
        case 'views':
        default:
          sortField = { 'views.count': -1 };
      }

      const articles = await Article.find(query)
        .populate('author', 'name affiliation')
        .populate('coAuthors', 'name affiliation')
        .populate('volume', 'volumeNumber year')
        .populate('issue', 'issueNumber')
        .sort(sortField)
        .limit(Number(limit));

      res.status(200).json({
        success: true,
        count: articles.length,
        data: articles,
      });
    }
  );

  // Increment citation count (called when article is cited)
  incrementCitationCount = asyncHandler(
    async (req: Request, res: Response): Promise<void> => {
      const { id } = req.params;

      const article = await Article.findOne({ _id: id, isPublished: true });

      if (!article) {
        throw new NotFoundError('Article not found');
      }

      const updatedArticle = await Article.findByIdAndUpdate(
        id,
        { $inc: { citationCount: 1 } },
        { new: true }
      );

      if (!updatedArticle) {
        throw new NotFoundError('Article not found');
      }

      logger.info(`Incremented citation count for article ${id}`);

      res.status(200).json({
        success: true,
        citationCount: updatedArticle.citationCount,
      });
    }
  );
}

export default new ArticleAnalyticsController();
