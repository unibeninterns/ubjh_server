import mongoose, { Document, Schema } from 'mongoose';

export interface IEmailSubscriber extends Document {
  email: string;
  isActive: boolean;
  unsubscribeToken?: string;
  subscribedAt: Date;
  lastEmailSent?: Date;
}

const EmailSubscriberSchema: Schema<IEmailSubscriber> = new Schema(
  {
    email: {
      type: String,
      required: [true, 'Email is required'],
      unique: true,
      lowercase: true,
      trim: true,
      match: [
        /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
        'Please provide a valid email address',
      ],
    },
    isActive: {
      type: Boolean,
      default: true,
    },
    unsubscribeToken: {
      type: String,
      unique: true,
      sparse: true,
    },
    subscribedAt: {
      type: Date,
      default: Date.now,
    },
    lastEmailSent: {
      type: Date,
    },
  },
  {
    timestamps: true,
  }
);

// Indexes
EmailSubscriberSchema.index({ isActive: 1 });

export default mongoose.model<IEmailSubscriber>(
  'EmailSubscriber',
  EmailSubscriberSchema,
  'EmailSubscribers'
);
