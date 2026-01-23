import { Suspense } from "react";
import LeaderboardContent from "./leaderboard-content";

export default function LeaderboardPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-muted-foreground">Loading leaderboard\u2026</div>
      </div>
    }>
      <LeaderboardContent />
    </Suspense>
  );
}
