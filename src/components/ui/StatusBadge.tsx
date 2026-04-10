const statusColors: Record<string, string> = {
  open: "bg-yellow-500/10 text-yellow-500 border-yellow-500/20",
  paid: "bg-brand-tealLt text-brand-tealDark border-brand-teal/20",
  shipped: "bg-blue-500/10 text-blue-500 border-blue-500/20",
  delivered: "bg-brand-tealLt text-brand-tealDark border-brand-teal/20",
  cancelled: "bg-brand-primaryLt text-brand-primary border-brand-primary/20",
};

interface StatusBadgeProps {
  status: string;
}

export function StatusBadge({ status }: StatusBadgeProps) {
  const colors = statusColors[status] ?? "bg-elevated text-faint border-line";

  return (
    <span
      className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-medium capitalize ${colors}`}
    >
      {status}
    </span>
  );
}
