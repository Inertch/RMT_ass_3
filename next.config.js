/** Production build is used for all measurements (npm run build && npm start). */
module.exports = {
  reactStrictMode: false,   // avoid double-invoked effects in dev; irrelevant in production
  poweredByHeader: false,
};
