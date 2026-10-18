export type ProgressBarTone = "primary" | "success" | "warning";

export function ProgressBar({
  value,
  label,
  tone = "primary",
  className = "",
}: {
  value: number;
  label: string;
  tone?: ProgressBarTone;
  className?: string;
}) {
  const normalizedValue = Number.isFinite(value) ? Math.min(Math.max(value, 0), 1) : 0;

  return (
    <progress
      className={`progress-bar progress-bar--${tone} ${className}`.trim()}
      value={normalizedValue}
      max={1}
      aria-label={label}
    />
  );
}
