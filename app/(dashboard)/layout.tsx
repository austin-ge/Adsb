import { Header } from "@/components/layout/header";
import { Sidebar } from "@/components/layout/sidebar";

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen flex flex-col">
      <a href="#dashboard-content" className="sr-only focus:not-sr-only focus:absolute focus:top-4 focus:left-4 focus:z-50 focus:px-4 focus:py-2 focus:bg-primary focus:text-primary-foreground focus:rounded-md">Skip to main content</a>
      <Header />
      <div className="flex-1 flex">
        <Sidebar />
        <main id="dashboard-content" className="flex-1 p-6">{children}</main>
      </div>
    </div>
  );
}
