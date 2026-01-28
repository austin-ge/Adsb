"use client";

import * as Sentry from "@sentry/nextjs";
import { useEffect } from "react";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // Report the error to Sentry
    Sentry.captureException(error, {
      extra: {
        digest: error.digest,
      },
      tags: {
        "error.boundary": "global",
      },
    });
  }, [error]);

  return (
    <html lang="en">
      <body>
        <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900">
          <div className="max-w-md w-full px-6 py-8 bg-white dark:bg-gray-800 rounded-lg shadow-lg">
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-4">
              Something went wrong
            </h1>
            <p className="text-gray-600 dark:text-gray-300 mb-6">
              An unexpected error occurred. Our team has been notified and is
              working to fix the issue.
            </p>
            {error.digest && (
              <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">
                Error ID: {error.digest}
              </p>
            )}
            <button
              onClick={reset}
              className="w-full px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-lg transition-colors focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2"
            >
              Try again
            </button>
          </div>
        </div>
      </body>
    </html>
  );
}
