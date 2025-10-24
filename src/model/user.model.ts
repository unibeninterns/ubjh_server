import mongoose, { Document, Schema, Types } from 'mongoose';
import bcrypt from 'bcryptjs';

// User roles in the system
export enum UserRole {
  ADMIN = 'admin',
  AUTHOR = 'author',
  REVIEWER = 'reviewer',
}

// User interface extending Mongoose Document
export interface IUser extends Document {
  name: string;
  email: string;
  password?: string;
  role: UserRole;
  faculty: string;
  assignedFaculty?: string;
  affiliation: string;
  orcid?: string;
  manuscripts?: Types.ObjectId[];
  assignedReviews?: Types.ObjectId[]; // For reviewers
  completedReviews?: Types.ObjectId[]; // For reviewers
  isActive: boolean;
  refreshToken?: string;
  inviteToken?: string;
  inviteTokenExpires?: Date;
  invitationStatus: 'pending' | 'accepted' | 'added' | 'expired' | 'none';
  credentialsSent: boolean;
  credentialsSentAt?: Date;
  lastLogin?: Date;
  createdAt: Date;
  comparePassword(candidatePassword: string): Promise<boolean>;
  generateInviteToken(): string;
}

// User Schema Definition
const UserSchema: Schema<IUser> = new Schema(
  {
    name: {
      type: String,
      trim: true,
    },
    email: {
      type: String,
      required: [true, 'Email is required'],
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
      default: UserRole.AUTHOR,
    },
    faculty: {
      type: String,
      trim: true,
      // Will contain the faculty and department here seperated by a comma
    },
    assignedFaculty: {
      type: String,
      trim: true,
    },
    affiliation: {
      type: String,
      trim: true,
      // Open to all institutions - not restricted to UNIBEN
    },
    orcid: {
      type: String,
      trim: true,
      match: [
        /^\d{4}-\d{4}-\d{4}-\d{3}[0-9X]$/,
        'Please provide a valid ORCID (format: 0000-0000-0000-0000)',
      ],
    },
    isActive: {
      type: Boolean,
      default: false,
    },
    manuscripts: [
      {
        type: Schema.Types.ObjectId,
        ref: 'Manuscript',
      },
    ],
    assignedReviews: [
      {
        type: Schema.Types.ObjectId,
        ref: 'Manuscript',
      },
    ],
    completedReviews: [
      {
        type: Schema.Types.ObjectId,
        ref: 'Review',
      },
    ],
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
    invitationStatus: {
      type: String,
      enum: ['pending', 'accepted', 'added', 'expired', 'none'],
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

// Indexes for performance optimization
UserSchema.index({ email: 1 }, { unique: true });
UserSchema.index({ role: 1, isActive: 1 });
UserSchema.index({ role: 1, faculty: 1, isActive: 1 }); // For reviewer assignment

UserSchema.pre<IUser>('save', async function (next) {
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

export default mongoose.model<IUser>('User', UserSchema, 'Users');
