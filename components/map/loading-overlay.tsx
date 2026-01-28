"use client";

interface LoadingOverlayProps {
  isLoading: boolean;
}

export function LoadingOverlay({ isLoading }: LoadingOverlayProps) {
  if (!isLoading) {
    return null;
  }

  return (
    <div className="absolute inset-0 flex items-center justify-center bg-gray-900/80">
      <div className="text-white text-lg font-medium animate-pulse">
        Loading aircraft data\u2026
      </div>
    </div>
  );
}
