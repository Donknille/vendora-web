export function MeshGradient() {
  return (
    <div
      aria-hidden
      className="absolute inset-0 -z-10 overflow-hidden pointer-events-none"
    >
      <div className="absolute left-1/2 top-0 -translate-x-1/2 -translate-y-1/3 h-[520px] w-[520px] rounded-full bg-brand-primary/20 blur-3xl motion-safe:animate-pulse-slow" />
      <div className="absolute right-[10%] top-[10%] h-[320px] w-[320px] rounded-full bg-green-300/20 blur-3xl motion-safe:animate-float-slow" />
      <div className="absolute left-[10%] top-[30%] h-[280px] w-[280px] rounded-full bg-emerald-200/20 blur-3xl motion-safe:animate-float-slower" />
    </div>
  );
}
