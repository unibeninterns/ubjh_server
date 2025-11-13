import { Schema, model, Document, Types } from 'mongoose';

export interface IIncompleteCoAuthor extends Document {
  manuscript: Types.ObjectId;
  name?: string;
  email?: string;
  faculty?: string;
  affiliation?: string;
  orcid?: string;
  status: 'incomplete' | 'complete';
}

const IncompleteCoAuthorSchema = new Schema(
  {
    manuscript: {
      type: Types.ObjectId,
      ref: 'Manuscript',
      required: true,
    },
    name: {
      type: String,
    },
    email: {
      type: String,
    },
    faculty: {
      type: String,
    },
    affiliation: {
      type: String,
    },
    orcid: {
      type: String,
    },
    status: {
      type: String,
      enum: ['incomplete', 'complete'],
      default: 'incomplete',
    },
  },
  {
    timestamps: true,
  }
);

const IncompleteCoAuthor = model<IIncompleteCoAuthor>(
  'IncompleteCoAuthor',
  IncompleteCoAuthorSchema
);

export default IncompleteCoAuthor;
