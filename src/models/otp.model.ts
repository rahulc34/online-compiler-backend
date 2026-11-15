import mongoose, { Schema, Document, Types } from "mongoose";

export type OtpPurpose = "email_verification";

export interface IOtp extends Document {
  userId: Types.ObjectId;
  otpHash: string;
  purpose: OtpPurpose;
  expiresAt: Date;
  attempts: number;
  lastSentAt: Date;
  createdAt: Date;
  updatedAt: Date;
}

const otpSchema = new Schema<IOtp>(
  {
    userId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },

    otpHash: {
      type: String,
      required: true,
      select: false,
    },

    purpose: {
      type: String,
      enum: ["email_verification"],
      required: true,
    },

    expiresAt: {
      type: Date,
      required: true,
      index: { expires: 0 },
    },

    attempts: {
      type: Number,
      default: 0,
      min: 0,
    },

    lastSentAt: {
      type: Date,
      required: true,
      default: Date.now,
    },
  },
  {
    timestamps: true,
  },
);

otpSchema.index({ userId: 1, purpose: 1 }, { unique: true });

const Otp = mongoose.model<IOtp>("Otp", otpSchema);

export default Otp;
