"use client";

// TODO: add auth guard — redirect to /login if no user
// TODO: render SessionSidebar alongside {children}
export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex h-screen">
      {/* TODO: <SessionSidebar ... /> */}
      <main className="flex-1 overflow-hidden">{children}</main>
    </div>
  );
}
