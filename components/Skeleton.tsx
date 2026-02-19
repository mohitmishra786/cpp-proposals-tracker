import { cn } from "@/lib/utils";

interface SkeletonProps {
  className?: string;
}

export function Skeleton({ className }: SkeletonProps) {
  return (
    <div
      className={cn(
        "animate-pulse rounded bg-terminal-border",
        className
      )}
    />
  );
}

export function ThreadCardSkeleton() {
  return (
    <div className="terminal-card">
      <Skeleton className="h-4 w-3/4 mb-3" />
      <div className="flex gap-4 mb-2">
        <Skeleton className="h-3 w-16" />
        <Skeleton className="h-3 w-16" />
        <Skeleton className="h-3 w-20" />
      </div>
      <Skeleton className="h-3 w-full mb-1" />
      <Skeleton className="h-3 w-5/6" />
    </div>
  );
}

export function EmailCardSkeleton() {
  return (
    <div className="terminal-card">
      <div className="flex gap-3 mb-3">
        <Skeleton className="w-8 h-8 rounded-full flex-shrink-0" />
        <div className="flex-1">
          <Skeleton className="h-4 w-32 mb-1" />
          <Skeleton className="h-3 w-24" />
        </div>
      </div>
      <Skeleton className="h-3 w-full mb-1" />
      <Skeleton className="h-3 w-5/6 mb-1" />
      <Skeleton className="h-3 w-4/6" />
    </div>
  );
}

export function AuthorCardSkeleton() {
  return (
    <div className="terminal-card">
      <div className="flex items-center gap-3 mb-3">
        <Skeleton className="w-10 h-10 rounded-full" />
        <div className="flex-1">
          <Skeleton className="h-4 w-24 mb-1" />
          <Skeleton className="h-3 w-16" />
        </div>
      </div>
      <Skeleton className="h-3 w-20" />
    </div>
  );
}
