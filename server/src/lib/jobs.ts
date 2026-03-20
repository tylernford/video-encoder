import { randomUUID } from "node:crypto";
import { EventEmitter } from "node:events";

type JobStatus = "encoding" | "done" | "error";

type EncodingOutputStatus = "pending" | "encoding" | "done" | "error";

type EncodingOutput = {
  suffix: string;
  codec: string;
  status: EncodingOutputStatus;
  progress: number;
  outputPath?: string;
  error?: string;
};

type Job = {
  id: string;
  status: JobStatus;
  inputPath: string;
  presetId: string;
  originalName: string;
  createdAt: Date;
  duration?: number;
  outputs: EncodingOutput[];
  emitter: EventEmitter;
  error?: string;
};

const jobs = new Map<string, Job>();

export function createJob(
  inputPath: string,
  presetId: string,
  originalName: string,
): Job {
  const job: Job = {
    id: randomUUID(),
    status: "encoding",
    inputPath,
    presetId,
    originalName,
    createdAt: new Date(),
    outputs: [],
    emitter: new EventEmitter(),
  };
  jobs.set(job.id, job);
  return job;
}

export function getJob(id: string): Job | undefined {
  return jobs.get(id);
}

export type { Job, JobStatus, EncodingOutput, EncodingOutputStatus };
