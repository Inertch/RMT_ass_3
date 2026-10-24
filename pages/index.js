import Link from 'next/link';
import { PAGES } from '../lib/pages';
export default function Home() {
  return (
    <div style={{ padding: 16 }}>
      <h1>Mini-LMS rendering benchmark</h1>
      {['csr', 'ssr', 'ssg'].map((s) => (
        <p key={s}><b>{s.toUpperCase()}</b>: {PAGES.map((p) => (<Link key={p} href={`/${s}/${p}`} prefetch={false} style={{ marginRight: 8 }}>{p}</Link>))}</p>
      ))}
    </div>
  );
}
