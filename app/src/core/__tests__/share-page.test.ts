import { describe, expect, it } from 'vitest';
import { esc, renderNotFound, renderSharePage, sharePagePath } from '../../../tools/site/share-page';
import { shareSlug, webLink } from '../history/saved';
import { makeItem } from './fixtures';

describe('share pages', () => {
  const item = makeItem({
    id: 'nasa:0158 35sec Green Run <Clip>',
    title: 'Green Run <b>hot fire</b>',
    description: 'An RS-25 cluster fired for eight minutes.',
    imagery: { posterUrl: 'https://images-assets.nasa.gov/x~large.jpg' },
  });

  it('lives exactly where the app links to', () => {
    expect(sharePagePath(item)).toBe(`d/${shareSlug(item.id)}/index.html`);
    expect(webLink(item.id).endsWith(`/d/${shareSlug(item.id)}/`)).toBe(true);
  });

  it('escapes provider text rather than trusting it', () => {
    const html = renderSharePage(item);
    expect(html).not.toContain('<b>hot fire</b>');
    expect(html).toContain('Green Run &lt;b&gt;hot fire&lt;/b&gt;');
  });

  it('carries a per-clip preview, a playable source and a way to the app', () => {
    const html = renderSharePage(item);
    expect(html).toContain('property="og:image" content="https://images-assets.nasa.gov/x~large.jpg"');
    expect(html).toContain(`<video src="${esc(item.stream.url)}"`);
    expect(html).toContain('apps.apple.com/app/id6764209094');
    expect(html).toContain('frontiergo://discovery/');
    expect(html).toContain('not affiliated with or endorsed by NASA');
  });

  it('never uses an agency title card as the preview', () => {
    const card = makeItem({ id: 'noaa:1:2', imagery: { posterUrl: 'https://oceanexplorer.noaa.gov/card.jpg', titleCard: true } });
    const html = renderSharePage(card);
    expect(html).not.toContain('card.jpg');
    expect(html).toContain('og-cover.png');
  });

  it('has a way back for links to clips that have left the catalog', () => {
    expect(renderNotFound()).toContain('moved on');
  });
});
