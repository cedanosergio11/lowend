export function BassMark({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      className={className}
      fill="none"
      aria-hidden="true"
    >
      <rect
        x="3.5"
        y="3.5"
        width="17"
        height="17"
        rx="3.5"
        className="stroke-accent"
        strokeWidth="1.2"
      />
      <path
        d="M6 8.2h12M6 11.4h12M6 14.6h12M6 17.8h12"
        className="stroke-fg"
        strokeWidth="1.15"
        strokeLinecap="round"
      />
    </svg>
  );
}
