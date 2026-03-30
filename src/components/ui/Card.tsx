import { type HTMLAttributes } from "react";

interface CardProps extends HTMLAttributes<HTMLDivElement> {
  children: React.ReactNode;
}

export function Card({ children, className = "", ...props }: CardProps) {
  return (
    <div
      className={`bg-zinc-900 rounded-xl p-4 border border-zinc-800 ${className}`}
      {...props}
    >
      {children}
    </div>
  );
}
