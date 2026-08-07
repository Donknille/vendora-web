"use client";

import { Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Legend, Line, ComposedChart } from "recharts";

export type GrowthPoint = { month: string; signups: number; cumulative: number };

/**
 * Signups per month (bars) against the running total (line). Client-only —
 * recharts needs the DOM, so the page imports this via next/dynamic.
 */
export function SignupChart({ data }: { data: GrowthPoint[] }) {
  if (data.length === 0) {
    return <p className="text-sm text-muted py-8 text-center">Noch keine Registrierungen.</p>;
  }

  return (
    <ResponsiveContainer width="100%" height={240}>
      <ComposedChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: -20 }}>
        <XAxis dataKey="month" tick={{ fontSize: 11 }} stroke="currentColor" opacity={0.5} />
        <YAxis allowDecimals={false} tick={{ fontSize: 11 }} stroke="currentColor" opacity={0.5} />
        <Tooltip
          contentStyle={{ fontSize: 12, borderRadius: 8 }}
          labelFormatter={(m) => `Monat ${m}`}
        />
        <Legend wrapperStyle={{ fontSize: 12 }} />
        <Bar dataKey="signups" name="Neu" fill="#D4AF37" radius={[4, 4, 0, 0]} />
        <Line dataKey="cumulative" name="Gesamt" stroke="#16a34a" strokeWidth={2} dot={false} />
      </ComposedChart>
    </ResponsiveContainer>
  );
}

// Also exported as default so next/dynamic can pick it up without a wrapper.
export default SignupChart;
