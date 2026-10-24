import { useEffect, useState } from 'react';
import Layout from '../../components/Layout';
import View from '../../components/View';
import { PAGES } from '../../lib/pages';

// CSR: the server ships a static shell + JS bundle; data is fetched in the browser (useEffect).
export default function CsrPage({ page }) {
  const [data, setData] = useState(null);
  useEffect(() => {
    let alive = true;
    fetch(`/api/data/${page}`).then((r) => r.json()).then((d) => { if (alive) setData(d); });
    return () => { alive = false; };
  }, [page]);
  return (<Layout strategy="CSR">{data ? <View page={page} data={data} /> : <p>Loading…</p>}</Layout>);
}
export async function getStaticPaths() {
  return { paths: PAGES.map((p) => ({ params: { page: p } })), fallback: false };
}
export async function getStaticProps({ params }) { return { props: { page: params.page } }; }
