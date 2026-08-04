import { Link } from "@tanstack/react-router";
import { Clock, Flame, Globe, Sparkles, Star } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { usd } from "@/lib/format";
import { difficultyLabel, experienceLabel, jobTypeLabel, type JobRow } from "@/lib/jobs";

export function JobCard({ job, categoryName }: { job: JobRow; categoryName?: string }) {
  return (
    <Link to="/tasks/$id" params={{ id: job.id }} className="group block h-full">
      <Card className="flex h-full flex-col transition-all group-hover:-translate-y-0.5 group-hover:border-primary/40 group-hover:shadow-md">
        <CardContent className="flex flex-1 flex-col p-5">
          <div className="grid grid-cols-[minmax(0,1fr)_auto] items-start gap-3">
            <div className="min-w-0">
              <p className="truncate text-xs font-medium uppercase tracking-wide text-primary">
                {jobTypeLabel(job.job_type)}
                {categoryName ? ` · ${categoryName}` : ""}
              </p>
              <h3 className="mt-1 line-clamp-2 font-semibold leading-snug">{job.title}</h3>
            </div>
            <Badge className="shrink-0 bg-brand-gradient text-primary-foreground">{usd(job.reward_cents)}</Badge>
          </div>

          <p className="mt-2 line-clamp-2 text-sm text-muted-foreground">{job.description}</p>

          {job.skills?.length > 0 && (
            <div className="mt-3 flex flex-wrap gap-1.5">
              {job.skills.slice(0, 4).map((s) => (
                <Badge key={s} variant="secondary" className="font-normal">
                  {s}
                </Badge>
              ))}
              {job.skills.length > 4 && (
                <Badge variant="outline" className="font-normal">
                  +{job.skills.length - 4}
                </Badge>
              )}
            </div>
          )}

          <div className="mt-auto flex flex-wrap items-center gap-x-3 gap-y-1.5 pt-4 text-xs text-muted-foreground">
            {job.est_minutes ? (
              <span className="inline-flex items-center gap-1">
                <Clock className="h-3.5 w-3.5 shrink-0" /> ~{job.est_minutes} min
              </span>
            ) : null}
            <span>{experienceLabel(job.experience_level)}</span>
            <span>{difficultyLabel(job.difficulty)}</span>
            {job.is_remote && (
              <span className="inline-flex items-center gap-1">
                <Globe className="h-3.5 w-3.5 shrink-0" /> Remote
              </span>
            )}
          </div>

          {(job.featured || job.is_urgent || job.is_recommended) && (
            <div className="mt-3 flex flex-wrap gap-1.5">
              {job.featured && (
                <Badge variant="secondary" className="gap-1">
                  <Star className="h-3 w-3" /> Featured
                </Badge>
              )}
              {job.is_recommended && (
                <Badge variant="secondary" className="gap-1">
                  <Sparkles className="h-3 w-3" /> Recommended
                </Badge>
              )}
              {job.is_urgent && (
                <Badge variant="destructive" className="gap-1">
                  <Flame className="h-3 w-3" /> Urgent
                </Badge>
              )}
            </div>
          )}
        </CardContent>
      </Card>
    </Link>
  );
}
