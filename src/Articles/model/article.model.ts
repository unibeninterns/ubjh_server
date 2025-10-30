import mongoose, { Document, Schema, Types } from 'mongoose';

export enum ArticleType {
  RESEARCH = 'research_article',
  REVIEW = 'review_article',
  CASE_STUDY = 'case_study',
  BOOK_REVIEW = 'book_review',
  EDITORIAL = 'editorial',
  COMMENTARY = 'commentary',
}

// Viewer tracking interface
export interface IViewer {
  identifier: string;
  timestamp: Date;
}

// Article interface extending Mongoose Document
export interface IArticle extends Document {
  // Core Content
  title: string;
  abstract: string;
  keywords: string[];
  pdfFile: string;

  // Authorship
  author: Types.ObjectId;
  coAuthors: Types.ObjectId[];

  // Provenance
  manuscriptId?: Types.ObjectId;

  // Publication Details
  publishDate: Date;
  doi?: string;
  crossrefBatchId?: string;
  crossrefDepositDate?: Date;
  crossrefStatus?: 'pending' | 'registered' | 'failed';
  volume: Types.ObjectId;
  issue: Types.ObjectId;
  articleType: ArticleType;
  pages?: {
    start: number;
    end: number;
  };

  // Metrics & Tracking
  views: {
    count: number;
    viewers: IViewer[];
  };
  downloads: {
    count: number;
    downloaders: IViewer[];
  };
  citationCount: number;

  // Licensing
  license: string;
  copyrightHolder: string;

  // Publication Status
  isPublished: boolean;
  publishedAt?: Date;

  // Indexing Status
  indexingStatus: {
    googleScholar: boolean;
    base: boolean;
    core: boolean;
    internetArchive: boolean;
  };
}

const ArticleSchema: Schema<IArticle> = new Schema(
  {
    title: {
      type: String,
      required: [true, 'Article title is required'],
      trim: true,
      maxlength: [500, 'Title cannot exceed 500 characters'],
    },
    abstract: {
      type: String,
      required: [true, 'Abstract is required'],
      trim: true,
      maxlength: [5000, 'Abstract cannot exceed 5000 characters'],
    },
    keywords: [
      {
        type: String,
        trim: true,
        maxlength: [50, 'Keyword cannot exceed 50 characters'],
      },
    ],
    pdfFile: {
      type: String,
      required: [true, 'PDF file is required'],
    },

    author: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'Author is required'],
    },
    coAuthors: [
      {
        type: Schema.Types.ObjectId,
        ref: 'User',
      },
    ],

    manuscriptId: {
      type: Schema.Types.ObjectId,
      ref: 'Manuscript',
      sparse: true,
    },

    publishDate: {
      type: Date,
      default: Date.now,
      required: [true, 'Publish date is required'],
    },
    doi: {
      type: String,
      trim: true,
      sparse: true,
      unique: true,
    },
    // Crossref Integration
    crossrefBatchId: {
      type: String,
    },
    crossrefDepositDate: {
      type: Date,
    },
    crossrefStatus: {
      type: String,
      enum: ['pending', 'registered', 'failed'],
      default: 'pending',
    },

    volume: {
      type: Schema.Types.ObjectId,
      ref: 'Volume',
      required: [true, 'Volume is required'],
    },
    issue: {
      type: Schema.Types.ObjectId,
      ref: 'Issue',
      required: [true, 'Issue is required'],
    },
    articleType: {
      type: String,
      enum: Object.values(ArticleType),
      required: [true, 'Article type is required'],
      default: ArticleType.RESEARCH,
    },
    pages: {
      start: {
        type: Number,
        min: [1, 'Start page must be at least 1'],
      },
      end: {
        type: Number,
        min: [1, 'End page must be at least 1'],
        validate: {
          validator: function (this: IArticle, value: number): boolean {
            return !this.pages?.start || value >= this.pages.start;
          },
          message: 'End page must be greater than or equal to start page',
        },
      },
    },

    views: {
      count: {
        type: Number,
        default: 0,
      },
      viewers: [
        {
          identifier: {
            type: String,
            required: true,
          },
          timestamp: {
            type: Date,
            default: Date.now,
          },
        },
      ],
    },
    downloads: {
      count: {
        type: Number,
        default: 0,
      },
      downloaders: [
        {
          identifier: {
            type: String,
            required: true,
          },
          timestamp: {
            type: Date,
            default: Date.now,
          },
        },
      ],
    },
    citationCount: {
      type: Number,
      default: 0,
      min: [0, 'Citation count cannot be negative'],
    },

    license: {
      type: String,
      default: 'CC BY 4.0',
    },
    copyrightHolder: {
      type: String,
      default: 'The Authors',
    },

    isPublished: {
      type: Boolean,
      default: false,
    },
    publishedAt: {
      type: Date,
    },

    indexingStatus: {
      googleScholar: {
        type: Boolean,
        default: false,
      },
      base: {
        type: Boolean,
        default: false,
      },
      core: {
        type: Boolean,
        default: false,
      },
      internetArchive: {
        type: Boolean,
        default: false,
      },
    },
  },
  {
    timestamps: true,
  }
);

// Indexes for performance optimization
ArticleSchema.index({ title: 'text', abstract: 'text', keywords: 'text' });
ArticleSchema.index({ publishDate: -1 });
ArticleSchema.index({ author: 1 });
ArticleSchema.index({ coAuthors: 1 });
ArticleSchema.index({ volume: 1, issue: 1 });
ArticleSchema.index({ isPublished: 1 });
ArticleSchema.index({ articleType: 1 });

export default mongoose.model<IArticle>('Article', ArticleSchema, 'Articles');
