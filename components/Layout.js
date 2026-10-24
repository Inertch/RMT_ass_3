import Link from 'next/link';
import { PAGES } from '../lib/pages';

// Identical header/nav for all strategies. prefetch={false} stops Next.js from silently
// downloading other routes after load, which would distort request counts and finish time.
export default function Layout({ strategy, children }) {
  return (
    <div className="wrap">
      <header>
        <strong>Mini-LMS</strong> <span data-testid="strategy">[{strategy}]</span>
        <nav>
          {PAGES.map((p) => (
            <Link key={p} href={`/${strategy.toLowerCase()}/${p}`} prefetch={false}>{p}</Link>
          ))}
        </nav>
      </header>
      <main>{children}</main>
    </div>
  );
}
