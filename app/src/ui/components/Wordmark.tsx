/**
 * frontier go. Lowercase always; `go` carries the bronze and a hair more
 * weight. That is the whole logo — there is nothing else to draw.
 */
export function Wordmark({ size = 'var(--step-4)', className = '' }: { size?: string; className?: string }) {
  return (
    <div className={`wordmark ${className}`} style={{ fontSize: size }}>
      frontier <span>go</span>
    </div>
  );
}

export function Tagline({ children = 'Real places. Bigger perspective.' }: { children?: string }) {
  return <div className="onboarding__foot" style={{ marginTop: 'var(--space-3)' }}>{children}</div>;
}

export default Wordmark;
