"use client";

import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Legend } from "recharts";
import { formatCurrency } from "@/lib/formatCurrency";

export interface MonthlyChartDatum {
  label: string;
  revenue: number; // cents
  expenses: number; // cents
}

export function MonthlyChart({
  data,
  revenueLabel,
  expensesLabel,
}: {
  data: MonthlyChartDatum[];
  revenueLabel: string;
  expensesLabel: string;
}) {
  return (
    <ResponsiveContainer width="100%" height={260}>
      <BarChart data={data} margin={{ top: 8, right: 8, left: 8, bottom: 0 }}>
        <XAxis dataKey="label" tick={{ fontSize: 11, fill: "currentColor" }} stroke="currentColor" />
        <YAxis
          tickFormatter={(v: number) => formatCurrency(v)}
          tick={{ fontSize: 11, fill: "currentColor" }}
          width={72}
          stroke="currentColor"
        />
        <Tooltip
          formatter={(value) => formatCurrency(Number(value) || 0)}
          contentStyle={{
            fontSize: 12,
            borderRadius: 8,
            background: "var(--color-surface)",
            border: "1px solid var(--color-line-hover)",
            color: "var(--color-primary)",
          }}
          itemStyle={{ color: "var(--color-primary)" }}
          labelStyle={{ color: "var(--color-secondary)" }}
          cursor={{ fill: "var(--color-hover)" }}
        />
        <Legend wrapperStyle={{ fontSize: 12 }} />
        {/* Dieselben Töne wie Kacheln und Tabelle (globals.css) — kein eigenes Rot. */}
        <Bar dataKey="revenue" name={revenueLabel} fill="var(--color-income)" radius={[3, 3, 0, 0]} />
        <Bar dataKey="expenses" name={expensesLabel} fill="var(--color-expense)" radius={[3, 3, 0, 0]} />
      </BarChart>
    </ResponsiveContainer>
  );
}
