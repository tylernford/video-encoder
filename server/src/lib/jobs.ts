import { randomUUID } from "node:crypto";

type JobStatus = "pending" | "encoding" | "done" | "error";

type Job = {
  id: string;
  status: JobStatus;
  inputPath: string;
  presetId: string;
  createdAt: Date;
  error?: string;
};

const jobs = new Map<string, Job>();

export function createJob(inputPath: string, presetId: string): Job {
  const job: Job = {
    id: randomUUID(),
    status: "pending",
    inputPath,
    presetId,
    createdAt: new Date(),
  };
  jobs.set(job.id, job);
  return job;
}

export function getJob(id: string): Job | undefined {
  return jobs.get(id);
}

export type { Job, JobStatus };
