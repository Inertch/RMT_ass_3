import Layout from '../../components/Layout';
import View from '../../components/View';
import { PAGES } from '../../lib/pages';
import { getPageData } from '../../lib/data';

// SSG: HTML (including data) is generated once at build time. Data is frozen until the next build.
export default function SsgPage({ page, data }) {
  return (<Layout strategy="SSG"><View page={page} data={data} /></Layout>);
}
export async function getStaticPaths() {
  return { paths: PAGES.map((p) => ({ params: { page: p } })), fallback: false };
}
export async function getStaticProps({ params }) {
  const data = await getPageData(params.page);
  return { props: { page: params.page, data } };
}
