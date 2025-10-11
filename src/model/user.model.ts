import mongoose, { Document, Schema, Types } from 'mongoose';
import bcrypt from 'bcryptjs';

export enum UserRole {
  ADMIN = 'admin',
  RESEARCHER = 'researcher',
  REVIEWER = 'reviewer',
}

export interface IUser extends Document {
  name: string;
  email: string;
  password?: string;
  role: UserRole;
  academicTitle?: string;
  phoneNumber: string;
  refreshToken?: string;
  inviteToken?: string;
  inviteTokenExpires?: Date;
  journals: Types.ObjectId[];
  assignedReviews?: Types.ObjectId[];
  reviews?: Types.ObjectId[];
  isActive: boolean;
  invitationStatus: 'pending' | 'added' | 'accepted' | 'expired';
  credentialsSent: boolean;
  credentialsSentAt?: Date;
  lastLogin?: Date;
  createdAt: Date;
  comparePassword(candidatePassword: string): Promise<boolean>;
}

const UserSchema: Schema<IUser> = new Schema(
  {
    name: {
      type: String,
      trim: true,
    },
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
    password: {
      type: String,
      select: false,
    },
    role: {
      type: String,
      enum: Object.values(UserRole),
      default: UserRole.RESEARCHER,
    },
    academicTitle: {
      type: String,
      trim: true,
    },
    phoneNumber: {
      type: String,
      trim: true,
    },
    refreshToken: {
      type: String,
      select: false,
    },
    inviteToken: {
      type: String,
    },
    inviteTokenExpires: {
      type: Date,
    },
    journals: [
      {
        type: Schema.Types.ObjectId,
        ref: 'Journal',
      },
    ],
    assignedReviews: [
      {
        type: Schema.Types.ObjectId,
        ref: 'Journal',
      },
    ],
    reviews: [
      {
        type: Schema.Types.ObjectId,
        ref: 'Review',
      },
    ],
    isActive: {
      type: Boolean,
      default: false,
    },
    invitationStatus: {
      type: String,
      enum: ['pending', 'accepted', 'added', 'expired'],
      default: 'pending',
    },
    credentialsSent: {
      type: Boolean,
      default: false,
    },
    credentialsSentAt: {
      type: Date,
    },
    lastLogin: {
      type: Date,
    },
    createdAt: {
      type: Date,
      default: Date.now,
    },
  },
  {
    timestamps: false, // Using custom createdAt field
  }
);

UserSchema.index({ role: 1, isActive: 1 });

UserSchema.pre('save', async function (next) {
  if (this.password && this.isModified('password')) {
    const salt = await bcrypt.genSalt(10);
    this.password = await bcrypt.hash(this.password, salt);
  }
  next();
});

UserSchema.methods.comparePassword = async function (
  candidatePassword: string
): Promise<boolean> {
  if (!this.password) return false;
  return await bcrypt.compare(candidatePassword, this.password);
};

export default mongoose.model<IUser>('User', UserSchema, 'users');
