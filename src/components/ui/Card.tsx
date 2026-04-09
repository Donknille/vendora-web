import { type HTMLAttributes } from "react";

interface CardProps extends HTMLAttributes<HTMLDivElement> {
  children: React.ReactNode;
}

export function Card({ children, className = "", ...props }: CardProps) {
  return (
    <div
      className={`bg-surface rounded-xl p-4 border border-line ${className}`}
      {...props}
    >
      {children}
    </div>
  );
}
