import mongoose, { Document, Schema, Types } from "mongoose";

export type ExecutionLanguage =
  | "cpp"
  | "java"
  | "python"
  | "javascript"
  | "typescript";

export type ExecutionStatus =
  | "queued"
  | "running"
  | "success"
  | "compilation_error"
  | "runtime_error"
  | "timeout"
  | "internal_error";

export interface IExecutionFile {
  name: string;
  content: string;
}

export interface IExecution extends Document {
  userId: Types.ObjectId;
  language: ExecutionLanguage;
  files: IExecutionFile[];
  stdin: string;

  status: ExecutionStatus;

  stdout: string;
  stderr: string;

  executionTime?: number;
  compilationTime?: number;
  memoryUsed?: number;
  exitCode?: number;

  createdAt: Date;
  updatedAt: Date;
}

const executionFileSchema = new Schema<IExecutionFile>(
  {
    name: {
      type: String,
      required: true,
      trim: true,
    },
    content: {
      type: String,
      required: true,
    },
  },
  { _id: false },
);

const executionSchema = new Schema<IExecution>(
  {
    userId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },

    language: {
      type: String,
      enum: ["cpp", "java", "python", "javascript", "typescript"],
      required: true,
    },

    files: {
      type: [executionFileSchema],
      required: true,
      validate: {
        validator: (files: IExecutionFile[]) => files.length > 0,
        message: "At least one source file is required",
      },
    },

    stdin: {
      type: String,
      default: "",
    },

    status: {
      type: String,
      enum: [
        "queued",
        "running",
        "success",
        "compilation_error",
        "runtime_error",
        "timeout",
        "internal_error",
      ],
      default: "queued",
      required: true,
    },

    stdout: {
      type: String,
      default: "",
    },

    stderr: {
      type: String,
      default: "",
    },

    executionTime: {
      type: Number,
      min: 0,
    },

    compilationTime: {
      type: Number,
      min: 0,
    },

    memoryUsed: {
      type: Number,
      min: 0,
    },

    exitCode: {
      type: Number,
    },
  },
  {
    timestamps: true,
  },
);

executionSchema.index({ userId: 1, createdAt: -1 });

const Execution = mongoose.model<IExecution>("Execution", executionSchema);

export default Execution;
