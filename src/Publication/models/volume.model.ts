import mongoose, { Document, Schema, Types } from 'mongoose';

export interface IVolume extends Document {
  volumeNumber: number;
  year: number;
  coverImage?: string;
  description?: string;
  publishDate: Date;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const VolumeSchema: Schema<IVolume> = new Schema(
  {
    volumeNumber: {
      type: Number,
      required: [true, 'Volume number is required'],
      unique: true,
      min: [1, 'Volume number must be at least 1'],
    },
    year: {
      type: Number,
      required: [true, 'Year is required'],
      min: [2020, 'Year must be 2020 or later'],
    },
    coverImage: {
      type: String,
      // URL path to cover image
    },
    description: {
      type: String,
      maxlength: [1000, 'Description cannot exceed 1000 characters'],
    },
    publishDate: {
      type: Date,
      default: Date.now,
    },
    isActive: {
      type: Boolean,
      default: true,
    },
  },
  {
    timestamps: true,
  }
);

// Indexes
VolumeSchema.index({ year: -1 });
VolumeSchema.index({ isActive: 1 });

export default mongoose.model<IVolume>('Volume', VolumeSchema, 'Volumes');
