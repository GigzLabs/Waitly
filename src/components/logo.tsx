import type { SVGProps } from "react";

/** The Waitly mark: a table from above, a ring with an opening and a guest dot. */
export function Mark({ size = 28, className, ...rest }: { size?: number } & SVGProps<SVGSVGElement>) {
  return (
    <svg width={size} height={size} viewBox="0 0 64 64" role="img" aria-label="Waitly" className={className} {...rest}>
      <path d="M52.92 30.17A21 21 0 1 1 33.83 11.08" fill="none" stroke="currentColor" strokeWidth="8" strokeLinecap="round" />
      <circle cx="46.85" cy="17.15" r="5" fill="currentColor" />
    </svg>
  );
}

export function Wordmark({ height = 22, className }: { height?: number; className?: string }) {
  return (
    <span className={className} style={{ fontSize: height, lineHeight: 1, fontWeight: 800, letterSpacing: "-0.03em" }}>
      waitly
    </span>
  );
}

export function Lockup({ size = 28, className }: { size?: number; className?: string }) {
  return (
    <span className={`inline-flex items-center gap-2 ${className ?? ""}`}>
      <Mark size={size} className="text-brand" />
      <Wordmark height={Math.round(size * 0.82)} className="text-ink" />
    </span>
  );
}
