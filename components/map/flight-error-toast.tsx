"use client";

interface FlightErrorToastProps {
  error: string | null;
  onDismiss: () => void;
}

export function FlightErrorToast({ error, onDismiss }: FlightErrorToastProps) {
  if (!error) {
    return null;
  }

  return (
    <div className="absolute top-20 left-1/2 -translate-x-1/2 z-30">
      <div className="bg-red-900/90 backdrop-blur-sm rounded-lg px-4 py-2 shadow-xl border border-red-700">
        <div className="flex items-center gap-2">
          <span className="text-red-200 text-sm">{error}</span>
          <button
            onClick={onDismiss}
            className="text-red-300 hover:text-white ml-2 min-w-[44px] min-h-[44px] flex items-center justify-center focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2 focus-visible:ring-offset-red-900 rounded"
            aria-label="Dismiss error"
          >
            &times;
          </button>
        </div>
      </div>
    </div>
  );
}
