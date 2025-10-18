import mongoose, { Document, Schema, Types } from 'mongoose';

// Viewer tracking interface
export interface IViewer {
  identifier: string; // IP address or session ID
  timestamp: Date;
}

// Article interface extending Mongoose Document
export interface IArticle extends Document {
  // Core Content
  title: string;
  abstract: string;
  keywords: string[];
  pdfFile: string; // URL path to PDF

  // Authorship
  author: Types.ObjectId; // Main author (from manuscript submitter)
  coAuthors: Types.ObjectId[]; // Co-authors

  // Provenance
  manuscriptId: Types.ObjectId; // Link to the original manuscript submission

  // Publication Details
  publishDate: Date;
  doi: string;
  volume: number;
  issue: number;
  pages?: {
    start: number;
    end: number;
  };

  // Metrics & Tracking
  views: {
    count: number;
    viewers: IViewer[];
  };

  citationCount: number;

  // Licensing
  license: string;
  copyrightHolder: string;
}

// Article Schema Definition
const ArticleSchema: Schema<IArticle> = new Schema(
  {
    // Core Content
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

    // Authorship
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

    // Provenance
    manuscriptId: {
      type: Schema.Types.ObjectId,
      ref: 'Manuscript',
      required: true,
      unique: true, // Each manuscript can only be published once
    },

    // Publication Details
    publishDate: {
      type: Date,
      default: Date.now,
      required: [true, 'Publish date is required'],
      // Set when published - can be custom date for archives or current date
    },
    doi: {
      type: String,
      required: [true, 'DOI is required'],
      trim: true,
      unique: true,
    },
    volume: {
      type: Number,
      required: [true, 'Volume is required'],
      min: [1, 'Volume must be at least 1'],
    },
    issue: {
      type: Number,
      required: [true, 'Issue is required'],
      min: [1, 'Issue must be at least 1'],
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

    // Metrics & Tracking
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
    citationCount: {
      type: Number,
      default: 0,
      min: [0, 'Citation count cannot be negative'],
    },

    // Licensing
    license: {
      type: String,
      default: 'CC BY 4.0',
    },
    copyrightHolder: {
      type: String,
      default: 'The Authors',
    },
  },
  {
    timestamps: true, // Automatically adds createdAt and updatedAt
  }
);

// Indexes for performance optimization
ArticleSchema.index({ title: 'text', abstract: 'text', keywords: 'text' }); // Full-text search

ArticleSchema.index({ publishDate: -1 }); // Sort by publication date
ArticleSchema.index({ author: 1 });
ArticleSchema.index({ coAuthors: 1 });

export default mongoose.model<IArticle>('Article', ArticleSchema, 'Articles');
