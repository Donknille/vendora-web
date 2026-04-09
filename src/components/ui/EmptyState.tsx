import { type ReactNode } from "react";

interface EmptyStateProps {
  icon: ReactNode;
  title: string;
  subtitle?: string;
}

export function EmptyState({ icon, title, subtitle }: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center py-16 px-4 text-center">
      <div className="mb-4 text-muted">{icon}</div>
      <h3 className="text-lg font-medium text-secondary">{title}</h3>
      {subtitle && (
        <p className="mt-1 text-sm text-muted max-w-xs">{subtitle}</p>
      )}
    </div>
  );
}
