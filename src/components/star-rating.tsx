import { Star } from "lucide-react";
import { cn } from "@/lib/utils";

export function StarRating({
  stars, size = "sm", label, className,
}: { stars: number; size?: "sm" | "md"; label?: string; className?: string }) {
  const dim = size === "md" ? "h-4 w-4" : "h-3.5 w-3.5";
  return (
    <span className={cn("inline-flex items-center gap-1", className)} aria-label={`${stars} out of 5 stars`}>
      <span className="flex">
        {[1, 2, 3, 4, 5].map(i => (
          <Star key={i} className={cn(dim, i <= stars ? "fill-amber-400 text-amber-400" : "text-muted-foreground/40")} />
        ))}
      </span>
      {label && <span className="text-xs text-muted-foreground">{label}</span>}
    </span>
  );
}
