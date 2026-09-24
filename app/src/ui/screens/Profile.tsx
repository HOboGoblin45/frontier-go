import { useEffect, useState } from 'react';
import { APP_STORE_URL, PRIVACY_URL, SUPPORT_URL, TERMS_URL } from '../../core/platform/site';
import { Icon } from '../components/Icon';
import type { LoadedCatalog } from '../../core/catalog/catalog';
import { diagnostics, videoInsetStatus } from '../../player/frontierPlayer';
import { describeVideoInset } from '../../player/types';
import type { PlayerDiagnostics } from '../../player/types';
import { sessionSummary } from '../../core/analytics/analytics';
import { getErrorLog } from '../../core/platform/errorLog';
import { Wordmark } from '../components/Wordmark';

/**
 * Settings, provenance and diagnostics.
 *
 * The native-player line at the bottom is the single most useful thing on this
 * screen: it is how anyone finds out, in ten seconds and without a Mac,
 * whether the Swift layer is actually bound on this build.
 */
export function Profile({
  catalog, ambient, version, onToggleAmbient, onShareApp,
}: {
  catalog: LoadedCatalog | null;
  ambient: boolean;
  version: string;
  onToggleAmbient: () => void;
  onShareApp: () => void;
}) {
  const [diag, setDiag] = useState<PlayerDiagnostics | null>(null);
  const [errors, setErrors] = useState<Array<{ t: string; kind: string; message: string }>>([]);
  const summary = sessionSummary();
  const inset = describeVideoInset(videoInsetStatus(), diag);

  useEffect(() => {
    void diagnostics().then(setDiag);
    void getErrorLog().then((log) => setErrors(log.slice(0, 5)));
  }, []);

  const attributions = catalog
    ? [...new Set(catalog.eligible.map((i) => i.source.organization))]
    : [];

  return (
    <div className="screen">
      <header className="screen__header">
        <h1 className="screen__title">Profile</h1>
      </header>

      <div className="screen__body scroll-y" style={{ padding: '0 var(--gutter) var(--space-7)' }}>
        <section style={{ marginBottom: 'var(--space-6)' }}>
          <h2 className="eyebrow" style={{ marginBottom: 'var(--space-3)' }}>Playback</h2>
          <button type="button" className="btn btn--secondary btn--block" onClick={onToggleAmbient}>
            {ambient ? 'Leave ambient mode' : 'Ambient mode'}
          </button>
          <p className="meta muted" style={{ marginTop: 'var(--space-3)' }}>
            Ambient mode hides everything but the picture and keeps playing. Made for a television.
          </p>
        </section>

        <section style={{ marginBottom: 'var(--space-6)' }}>
          <h2 className="eyebrow" style={{ marginBottom: 'var(--space-3)' }}>Where this comes from</h2>
          <div className="panel" style={{ padding: 'var(--space-4)' }}>
            {attributions.map((org) => (
              <p className="meta" key={org} style={{ marginBottom: 6 }}>{org}</p>
            ))}
            <p className="meta muted" style={{ marginTop: 'var(--space-3)' }}>
              Every clip in this app is public-domain or openly licensed material published by the
              organisation credited on it. Nothing is redistributed beyond what those terms allow,
              and anything whose rights could not be confirmed is left out.
            </p>
            {catalog ? (
              <p className="meta muted" style={{ marginTop: 'var(--space-3)' }}>
                {catalog.eligible.length} discoveries &middot; catalog built{' '}
                {new Date(catalog.generatedAt).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}
              </p>
            ) : null}
            <p className="meta muted" style={{ marginTop: 'var(--space-3)' }}>
              frontier go is an independent app. It is not affiliated with, sponsored by or endorsed by
              the National Park Service, the Library of Congress, NASA, NOAA or any government agency.
            </p>
          </div>
        </section>

        <section style={{ marginBottom: 'var(--space-6)' }}>
          <h2 className="eyebrow" style={{ marginBottom: 'var(--space-3)' }}>About</h2>
          <div className="row-list">
            {[
              { label: 'Share frontier go', href: null, action: onShareApp },
              { label: 'Support', href: SUPPORT_URL },
              { label: 'Privacy policy', href: PRIVACY_URL },
              { label: 'Terms of use', href: TERMS_URL },
              { label: 'Rate on the App Store', href: `${APP_STORE_URL}?action=write-review` },
            ].map((l) => (
              l.href ? (
                <a key={l.label} className="row" style={{ gridTemplateColumns: '1fr auto', textDecoration: 'none', color: 'inherit' }} href={l.href} target="_blank" rel="noopener noreferrer">
                  <span className="row__title">{l.label}</span>
                  <Icon name="chevron-right" size={18} />
                </a>
              ) : (
                <button key={l.label} type="button" className="row" style={{ gridTemplateColumns: '1fr auto' }} onClick={l.action ?? undefined}>
                  <span className="row__title">{l.label}</span>
                  <Icon name="share" size={18} />
                </button>
              )
            ))}
          </div>
        </section>

        <section style={{ marginBottom: 'var(--space-6)' }}>
          <h2 className="eyebrow" style={{ marginBottom: 'var(--space-3)' }}>Privacy</h2>
          <p className="meta muted">
            No account, no sign-in, no location permission. What you have watched and saved stays on
            this device, and this app never asks where you are — the geography you see belongs to the
            footage, not to you.
          </p>
        </section>

        <section style={{ marginBottom: 'var(--space-6)' }}>
          <h2 className="eyebrow" style={{ marginBottom: 'var(--space-3)' }}>This session</h2>
          <dl className="def">
            <dt>Discoveries</dt><dd>{summary.itemsPlayed}</dd>
            <dt>Shuffles</dt><dd>{summary.shuffles}</dd>
            <dt>Auto-advances</dt><dd>{summary.autoAdvances}</dd>
            <dt>First frame p50</dt><dd>{summary.firstFrameP50 != null ? `${summary.firstFrameP50} ms` : 'not measured'}</dd>
            <dt>Shuffle p95</dt><dd>{summary.shuffleP95 != null ? `${summary.shuffleP95} ms` : 'not measured'}</dd>
            <dt>Playback failures</dt><dd>{summary.failures}</dd>
          </dl>
        </section>

        <section style={{ marginBottom: 'var(--space-6)' }}>
          <h2 className="eyebrow" style={{ marginBottom: 'var(--space-3)' }}>Diagnostics</h2>
          <dl className="def">
            <dt>Version</dt><dd>{version}</dd>
            <dt>Player</dt>
            <dd style={{ color: diag?.native ? 'var(--text-secondary)' : 'var(--accent-secondary)' }}>
              {diag ? (diag.native ? 'Native AVFoundation · active' : 'Web fallback · native NOT bound') : 'checking'}
            </dd>
            <dt>Video surface</dt>
            <dd style={{ color: diag && diag.native && !diag.webViewTransparent ? 'var(--accent-secondary)' : 'var(--text-secondary)' }}>
              {!diag ? 'checking'
                : !diag.native ? 'n/a'
                  : diag.webViewTransparent ? 'transparent \u00b7 video visible'
                    : diag.webViewBound === false ? 'NOT BOUND \u00b7 the player never got the web view'
                      : 'OPAQUE \u00b7 the interface is covering the video'}
            </dd>
            <dt>Surface layer</dt>
            <dd style={{ color: diag && diag.native && diag.surfaceDetached === false ? 'var(--accent-secondary)' : 'var(--text-secondary)' }}>
              {!diag || !diag.native ? 'n/a'
                : diag.surfaceDetached ? 'sibling of the web view'
                  : 'INSIDE the web view'}
            </dd>
            <dt>AirPlay control</dt>
            <dd style={{ color: diag?.native && diag.routePicker !== 'over the button' && diag.routePicker !== 'hidden' ? 'var(--accent-secondary)' : 'var(--text-secondary)' }}>
              {!diag || !diag.native ? 'n/a'
                : `${diag.routePicker || 'unknown'} \u00b7 opened ${diag.routePickerPresentations ?? 0} ${diag.routePickerPresentations === 1 ? 'time' : 'times'}`}
            </dd>
            <dt>Picture inset</dt>
            <dd style={{ color: inset.bad ? 'var(--accent-secondary)' : 'var(--text-secondary)' }}>{inset.text}</dd>
            <dt>Picture in Picture</dt><dd>{diag?.pipSupported ? 'supported' : 'unavailable'}</dd>
            <dt>Audio session</dt><dd>{diag?.audioSessionCategory || 'n/a'}</dd>
          </dl>
          {errors.length > 0 ? (
            <div className="panel" style={{ padding: 'var(--space-3)', marginTop: 'var(--space-3)' }}>
              {errors.map((e) => (
                <p className="meta muted" key={e.t} style={{ marginBottom: 4 }}>{e.kind}: {e.message}</p>
              ))}
            </div>
          ) : null}
        </section>

        <div style={{ textAlign: 'center', paddingTop: 'var(--space-5)' }}>
          <Wordmark size="var(--step-2)" />
          <p className="onboarding__foot" style={{ marginTop: 'var(--space-2)' }}>Real places. Bigger perspective.</p>
        </div>
      </div>
    </div>
  );
}

export default Profile;
