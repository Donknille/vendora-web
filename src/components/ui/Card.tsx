import { type HTMLAttributes } from "react";

interface CardProps extends HTMLAttributes<HTMLDivElement> {
  children: React.ReactNode;
}

export function Card({ children, className = "", ...props }: CardProps) {
  return (
    <div
      className={`bg-surface rounded-2xl p-4 border border-line shadow-sm ${className}`}
      {...props}
    >
      {children}
    </div>
  );
}
