// Shimmer skeletons for loading states (PLATFORM_REVIEW §5.2). `.skeleton` is defined in globals.css.
export function Skeleton({ className = '' }) {
  return <div className={`skeleton rounded-md ${className}`} />;
}

export function SkeletonText({ lines = 3, className = '' }) {
  return (
    <div className={`space-y-2 ${className}`}>
      {Array.from({ length: lines }).map((_, i) => (
        <Skeleton key={i} className={`h-3 ${i === lines - 1 ? 'w-2/3' : 'w-full'}`} />
      ))}
    </div>
  );
}

export function SkeletonCard({ className = '' }) {
  return (
    <div className={`bg-white rounded-card border border-hairline p-4 ${className}`}>
      <Skeleton className="h-4 w-1/3 mb-3" />
      <SkeletonText lines={3} />
    </div>
  );
}

export function SkeletonRows({ rows = 6, className = '' }) {
  return (
    <div className={`space-y-2 ${className}`}>
      {Array.from({ length: rows }).map((_, i) => (
        <Skeleton key={i} className="h-14 w-full rounded-card" />
      ))}
    </div>
  );
}
