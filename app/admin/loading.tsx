// app/admin/loading.tsx
export default function AdminLoading() {
  return (
    <div className="p-8 max-w-7xl mx-auto space-y-8 animate-pulse">
      {/* Admin Header */}
      <div className="flex justify-between items-end">
        <div className="space-y-3">
          <div className="h-4 w-24 bg-gray-200 rounded text-xs"></div>
          <div className="h-8 w-64 bg-gray-200 rounded-lg"></div>
        </div>
        <div className="space-y-2">
          <div className="h-4 w-32 bg-gray-100 rounded ml-auto"></div>
          <div className="h-3 w-40 bg-gray-50 rounded ml-auto"></div>
        </div>
      </div>

      {/* Summary Cards Skeleton */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="h-32 bg-gray-100 rounded-2xl border border-gray-100"></div>
        ))}
      </div>

      {/* Main Content Area Skeleton */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="h-96 bg-gray-50 rounded-2xl border border-gray-100"></div>
        <div className="h-96 bg-gray-50 rounded-2xl border border-gray-100"></div>
      </div>
    </div>
  );
}
