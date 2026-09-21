import { useEffect, useState } from 'react';
import { listWatchlist, removeSaved } from '../lib/watchlist.js';
import { useOverlay } from '../features/overlay.js';

export default function SavedMovies({ open, onClose, onPick }) {
  const { mounted, closing, close, dialogProps } = useOverlay({open,onClose,label:'Saved movies'});
  const [movies, setMovies] = useState([]);
  const [error, setError] = useState(false);
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    if (!open) return undefined;
    let cancelled = false;
    setError(false);
    listWatchlist().then(items => { if (!cancelled) setMovies(items); });
    return () => { cancelled = true; };
  }, [open]);
  async function remove(id) {
    setBusy(true);
    setError(false);
    try { await removeSaved(id); setMovies(await listWatchlist()); }
    catch { setError(true); }
    finally { setBusy(false); }
  }
  if (!mounted) return null;
  return <div className={`screen saved-screen${closing ? ' is-closing' : ''}`} {...dialogProps}>
    <header className="screen-header"><button className="back-btn" onClick={close} aria-label="Back">◂</button><h1>Saved movies</h1><span /></header>
    <section className="about-section">
      <p>Your list stays on this device.</p>
      {error && <p role="alert">Could not update your saved movies. Please try again.</p>}
      {!movies.length && <p>Nothing saved yet. Open About this movie and tap Save.</p>}
      {movies.map(movie => <div className="saved-row" key={movie.id}>
        <button className="saved-title" onClick={() => onPick(movie)}>{movie.title || 'Untitled movie'}{movie.year ? ` (${movie.year})` : ''}</button>
        <button className="diagnostics-toggle" disabled={busy} onClick={() => remove(movie.id)} aria-label={`Remove ${movie.title}`}>Remove</button>
      </div>)}
    </section>
  </div>;
}
