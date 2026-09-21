import { Wordmark } from '../components/Wordmark';
import { Icon } from '../components/Icon';

/**
 * One screen, one button, no questions.
 *
 * No account, no interests, no categories, no location permission — the first
 * useful thing this app shows anyone is footage, and everything between the
 * icon and that footage is a tax.
 */
export function Onboarding({ onStart, busy }: { onStart: () => void; busy: boolean }) {
  return (
    <div className="onboarding">
      <div className="onboarding__horizon" aria-hidden="true" />
      <div className="onboarding__mark">
        <Wordmark size="var(--step-4)" />
        <p className="onboarding__line">Go somewhere<br />extraordinary.</p>
      </div>

      <div>
        <button type="button" className="btn btn--primary btn--block" onClick={onStart} disabled={busy}>
          {busy ? 'Preparing' : 'Start Exploring'} <Icon name="arrow-right" size={18} />
        </button>
        <p className="meta muted" style={{ textAlign: 'center', marginTop: 'var(--space-4)' }}>
          Shuffle anytime. Every tap takes you somewhere else.
        </p>
      </div>

      <div className="onboarding__foot">Nature &middot; Science &middot; People</div>
    </div>
  );
}

export default Onboarding;
