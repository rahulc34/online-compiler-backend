import mongoose, { Schema, Document } from "mongoose";

export type UserRole = "user" | "admin";
export type UserStatus = "active" | "banned";

export interface IUser extends Document {
  name: string;
  email: string;

  passwordHash?: string;
  googleId?: string;

  sessionVersion: number;

  isEmailVerified: boolean;
  emailVerifiedAt?: Date;

  role: UserRole;
  status: UserStatus;

  lastLoginAt?: Date;

  createdAt: Date;
  updatedAt: Date;
}

const userSchema = new Schema<IUser>(
  {
    name: {
      type: String,
      required: true,
      trim: true,
      minlength: 2,
      maxlength: 50,
    },

    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
    },

    passwordHash: {
      type: String,
      select: false,
    },

    googleId: {
      type: String,
      unique: true,
      sparse: true,
    },

    sessionVersion: {
      type: Number,
      default: 0,
      min: 0,
    },

    isEmailVerified: {
      type: Boolean,
      default: false,
    },

    emailVerifiedAt: {
      type: Date,
    },

    role: {
      type: String,
      enum: ["user", "admin"],
      default: "user",
    },

    status: {
      type: String,
      enum: ["active", "banned"],
      default: "active",
    },

    lastLoginAt: {
      type: Date,
    },
  },
  {
    timestamps: true,
  },
);

const User = mongoose.model<IUser>("User", userSchema);

export default User;
