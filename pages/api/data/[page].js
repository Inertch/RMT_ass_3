import { PAGES } from '../../../lib/pages';
import { getPageData } from '../../../lib/data';

// Data endpoint used only by the CSR pages (same data function and delay as SSR/SSG).
export default async function handler(req, res) {
  const { page } = req.query;
  if (!PAGES.includes(page)) return res.status(404).json({ error: 'unknown page' });
  const data = await getPageData(page);
  res.setHeader('Cache-Control', 'no-store');
  res.status(200).json(data);
}
