import Layout from '../../components/Layout';
import View from '../../components/View';
import { PAGES } from '../../lib/pages';
import { getPageData } from '../../lib/data';

// SSR: HTML (including data) is generated on the server for every request.
export default function SsrPage({ page, data }) {
  return (<Layout strategy="SSR"><View page={page} data={data} /></Layout>);
}
export async function getServerSideProps({ params }) {
  if (!PAGES.includes(params.page)) return { notFound: true };
  const data = await getPageData(params.page);
  return { props: { page: params.page, data } };
}
