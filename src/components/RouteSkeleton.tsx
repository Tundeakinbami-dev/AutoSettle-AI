import React from "react";

export default function RouteSkeleton({
  title = "Loading...",
  subtitle = "Fetching latest records...",
}: {
  title?: string;
  subtitle?: string;
}) {
  return (
    <div className="px-4 sm:px-6 lg:px-8 py-6 space-y-6 max-w-[1600px] mx-auto w-full animate-pulse">
      {/* Header Skeleton */}
      <div className="flex items-center justify-between pb-2 border-b border-slate-200">
        <div className="space-y-2">
          <div className="h-6 w-48 bg-slate-200 rounded-lg" />
          <div className="h-3.5 w-72 bg-slate-100 rounded-md" />
        </div>
        <div className="flex gap-2">
          <div className="h-9 w-24 bg-slate-200 rounded-xl" />
          <div className="h-9 w-28 bg-slate-200 rounded-xl" />
        </div>
      </div>

      {/* 4 Cards Skeleton */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[1, 2, 3, 4].map((i) => (
          <div
            key={i}
            className="rounded-2xl bg-white border border-slate-200 p-4 shadow-sm flex items-center gap-3"
          >
            <div className="w-10 h-10 rounded-xl bg-slate-100 shrink-0" />
            <div className="space-y-2 flex-1">
              <div className="h-5 w-20 bg-slate-200 rounded" />
              <div className="h-3 w-28 bg-slate-100 rounded" />
            </div>
          </div>
        ))}
      </div>

      {/* Main Table / Content Area Skeleton */}
      <div className="rounded-2xl bg-white border border-slate-200 shadow-sm p-5 space-y-4">
        <div className="flex justify-between items-center">
          <div className="h-5 w-36 bg-slate-200 rounded" />
          <div className="h-8 w-60 bg-slate-100 rounded-lg" />
        </div>
        <div className="space-y-3">
          {[1, 2, 3, 4, 5, 6].map((row) => (
            <div
              key={row}
              className="h-12 bg-slate-50 border border-slate-100 rounded-xl flex items-center px-4 justify-between"
            >
              <div className="h-4 w-32 bg-slate-200 rounded" />
              <div className="h-4 w-48 bg-slate-100 rounded" />
              <div className="h-4 w-20 bg-slate-200 rounded" />
              <div className="h-6 w-24 bg-slate-200 rounded-full" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
