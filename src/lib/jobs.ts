export type JobType =
  | "micro_task"
  | "freelance_project"
  | "gig"
  | "remote_job"
  | "service_request"
  | "contest";
export type ExperienceLevel = "entry" | "intermediate" | "expert";
export type JobDifficulty = "easy" | "medium" | "hard";

export const JOB_TYPES: { value: JobType; label: string; blurb: string }[] = [
  { value: "micro_task", label: "Micro Task", blurb: "Short jobs finished in minutes" },
  { value: "freelance_project", label: "Freelance Project", blurb: "Scoped deliverables with a brief" },
  { value: "gig", label: "Gig", blurb: "Packaged service with a fixed price" },
  { value: "remote_job", label: "Remote Opportunity", blurb: "Ongoing remote work" },
  { value: "service_request", label: "Service Request", blurb: "A client needs something done" },
  { value: "contest", label: "Contest", blurb: "Compete — best entry wins" },
];

export const EXPERIENCE_LEVELS: { value: ExperienceLevel; label: string }[] = [
  { value: "entry", label: "Entry level" },
  { value: "intermediate", label: "Intermediate" },
  { value: "expert", label: "Expert" },
];

export const DIFFICULTIES: { value: JobDifficulty; label: string }[] = [
  { value: "easy", label: "Easy" },
  { value: "medium", label: "Medium" },
  { value: "hard", label: "Hard" },
];

export const jobTypeLabel = (v: string | null | undefined) =>
  JOB_TYPES.find((t) => t.value === v)?.label ?? "Micro Task";
export const experienceLabel = (v: string | null | undefined) =>
  EXPERIENCE_LEVELS.find((t) => t.value === v)?.label ?? "Entry level";
export const difficultyLabel = (v: string | null | undefined) =>
  DIFFICULTIES.find((t) => t.value === v)?.label ?? "Easy";

export type JobRow = {
  id: string;
  title: string;
  description: string;
  reward_cents: number;
  est_minutes: number | null;
  featured: boolean;
  category_id: string | null;
  job_type: JobType;
  experience_level: ExperienceLevel;
  difficulty: JobDifficulty;
  skills: string[];
  tags: string[];
  is_remote: boolean;
  is_urgent: boolean;
  is_recommended: boolean;
  created_at: string;
  priority: number;
};

export const JOB_SELECT =
  "id,title,description,reward_cents,est_minutes,featured,category_id,job_type,experience_level,difficulty,skills,tags,is_remote,is_urgent,is_recommended,created_at,priority";

const RECENT_KEY = "zurify:recent-jobs";

export function pushRecentJob(id: string) {
  if (typeof window === "undefined") return;
  try {
    const prev = JSON.parse(window.localStorage.getItem(RECENT_KEY) ?? "[]") as string[];
    const next = [id, ...prev.filter((x) => x !== id)].slice(0, 8);
    window.localStorage.setItem(RECENT_KEY, JSON.stringify(next));
  } catch {
    /* ignore */
  }
}

export function readRecentJobs(): string[] {
  if (typeof window === "undefined") return [];
  try {
    return JSON.parse(window.localStorage.getItem(RECENT_KEY) ?? "[]") as string[];
  } catch {
    return [];
  }
}
