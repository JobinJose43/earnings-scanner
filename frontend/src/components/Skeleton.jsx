export function Skeleton({ className = "" }) {
  return (
    <div className={`animate-pulse bg-gray-800 rounded ${className}`} />
  );
}

export function SkeletonRow() {
  return (
    <tr className="border-b border-gray-800/50">
      <td className="px-3 py-3"><Skeleton className="h-4 w-4" /></td>
      <td className="px-3 py-3">
        <Skeleton className="h-4 w-12 mb-1" />
        <Skeleton className="h-3 w-28" />
      </td>
      <td className="px-3 py-3"><Skeleton className="h-6 w-12 rounded-full" /></td>
      <td className="px-3 py-3"><Skeleton className="h-4 w-16" /></td>
      <td className="px-3 py-3"><Skeleton className="h-4 w-10" /></td>
      <td className="px-3 py-3"><Skeleton className="h-4 w-20" /></td>
      <td className="px-3 py-3"><Skeleton className="h-4 w-8" /></td>
      <td className="px-3 py-3"><Skeleton className="h-4 w-14" /></td>
      <td className="px-3 py-3"><Skeleton className="h-4 w-14" /></td>
      <td className="px-3 py-3"><Skeleton className="h-4 w-12" /></td>
      <td className="px-3 py-3"><Skeleton className="h-4 w-16" /></td>
    </tr>
  );
}
