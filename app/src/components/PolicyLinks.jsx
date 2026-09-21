import { LINKS } from '../lib/release.js';

export default function PolicyLinks() {
  return <span className="policy-links">
    <a href={LINKS.privacy} target="_blank" rel="noopener noreferrer">Privacy policy</a>
    {' · '}<a href={LINKS.terms} target="_blank" rel="noopener noreferrer">Terms</a>
    {' · '}<a href={LINKS.youtube} target="_blank" rel="noopener noreferrer">YouTube Terms of Service</a>
  </span>;
}
