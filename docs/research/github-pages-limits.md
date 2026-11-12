# Research: GitHub Pages limits (ticket #268, map #266)

Date checked: 2026-11-11. Live site: https://mquesada02.github.io/portdle/. Read-only GETs/HEADs only.

## Answer

- Cache: Pages serves everything with `cache-control: max-age=600` (10 min) and an ETag. A project site cannot change it: no header configuration exists, and `<meta http-equiv>` cannot set HTTP cache headers. Hashed assets therefore always have TTL 600 s, so Lighthouse's long-cache audit (`uses-long-cache-ttl`, replaced by `cache-insight`) will flag them. Treat it as an accepted residual or waive it in the targets.
- Deep links: the site already copies index.html to 404.html (`scripts/copy-index-html-to-404.ts`, run by `pnpm build`). So every non-root route (`/portdle/history`, `/portdle/archive`) returns the SPA shell with status **404**. Browsers render it; Googlebot ignores 4xx content (deep routes are not indexed); Lighthouse `http-status-code` fails any 400-599 main-resource status.
- `is-crawlable` does not read the status, only meta robots, X-Robots-Tag and `/robots.txt` of the origin. It passes today (origin robots.txt is a 404, so no restrictions).
- Fixes that stay on Pages: prerendered per-route `index.html` files (real 200 per route). The 404.html redirect trick does not make the first response a 200, so it does not help Lighthouse or Google.
- robots.txt must be at the host root. Only the repo `mquesada02/mquesada02.github.io` could serve it; `/portdle/robots.txt` has no effect. A sitemap can live at `/portdle/sitemap.xml` and covers only descendants of `/portdle/` unless submitted in Search Console.
- Compression: gzip only, no Brotli. HTTP/2 on; HTTP/3 not advertised (not tested directly).
- Pages limits: 1 GB site, 100 GB/month soft bandwidth, 10 min deploy timeout; a custom Actions workflow (as here) is exempt from the 10 builds/hour soft limit.

## 1. Cache headers

Measured (raw headers below): index.html, the hashed JS, the hashed CSS and `privacy.html` all return `cache-control: max-age=600`, an `expires` 10 minutes ahead, an ETag (weak for generated files, strong for privacy.html) and `last-modified` = deploy time. No `immutable`, no `s-maxage`, no per-path difference. Fastly (`via: 1.1 varnish`) sits in front.

Can a site change them? The Pages docs say nothing about headers or caching
(https://docs.github.com/en/pages/getting-started-with-github-pages/github-pages-limits,
https://docs.github.com/en/pages/getting-started-with-github-pages/about-github-pages,
https://docs.github.com/en/pages/getting-started-with-github-pages/creating-a-custom-404-page-for-your-github-pages-site).
A `_headers` file or a Vite option has no effect on a host that does not read it. "No way to configure" is an inference from the absent docs and the measurement (UNVERIFIED as an explicit docs statement). A service worker could cache assets client-side but does not change a first-load Lighthouse run (empty cache); mentioned only, not recommended.

Lighthouse side: `cache-insight` declares `replacesAudits: ['uses-long-cache-ttl']`, lists requests by TTL, wasted bytes and size, and has no scoring formula in its own file
(https://raw.githubusercontent.com/GoogleChrome/lighthouse/main/core/audits/insights/cache-insight.js).
The exact TTL threshold and exempt requests are UNVERIFIED (the `uses-long-cache-ttl.js` source was not retrievable at its path). Expect the JS and CSS to be reported at 600 s. The targets should not require a pass on this audit, or should name it as a waiver.

## 2. Deep links and status

Code facts (worktree t254-spec7-map):
- `vite.config.ts`: `base: "/portdle/"`. `src/router.tsx`: `basepath: "/portdle"`, routes `/`, `/protocols`, `/applications`, `/archive`, `/archive/$category/$date`, `/blitz`, `/history`, `/history/blitz`, `/codex`, `/help`.
- `package.json` build: `tsc -b && vite build && tsx scripts/copy-index-html-to-404.ts` (404.html identical to index.html; test in `scripts/copy-index-html-to-404.test.ts`). The `deploy` job in `.github/workflows/ci.yml` builds, runs `upload-pages-artifact` on `dist`, then `deploy-pages`. `public/` holds favicons, apple-touch-icon and privacy.html: no 404.html, robots.txt or sitemap (404.html is generated into `dist`).

Measured: `/portdle/` is 200. `/portdle/history`, `/portdle/archive` (real routes), `/portdle/daily` and `/portdle/nonexistent` all return **HTTP 404** with the SPA shell body (same ETag as index.html). Every non-root route is a 404 on a cold request.

What each consumer sees:
- Browsers: the shell renders and the router takes over.
- Lighthouse `http-status-code`: fails any main-resource status 400-599 with score 0; runs in navigation mode (https://raw.githubusercontent.com/GoogleChrome/lighthouse/main/core/audits/seo/http-status-code.js). Any Lighthouse run on a deep link fails it; `/portdle/` passes.
- Googlebot: "Google doesn't index URLs that return a 4xx status code" and "Any content Google receives from URLs that return a 4xx status code is ignored" (https://developers.google.com/search/docs/crawling-indexing/http-network-errors). The JS-SEO guide warns about SPAs that report 200 for errors (soft 404) and recommends the History API (https://developers.google.com/search/docs/crawling-indexing/javascript/fix-search-javascript). Whether Google renders a 404 body is not stated: UNVERIFIED, but the page above says the content is ignored.
- SEO effect: only `/portdle/` is indexable today. For a daily game with one main screen that is probably acceptable; no current requirement to rank archive or history pages.

Workarounds that stay on Pages:
1. Prerendered per-route files (`dist/history/index.html`, `dist/archive/index.html`, ...). Pages should serve `/portdle/history` (directory index) as 200; UNVERIFIED here, a ticket must test it. The dynamic `/archive/$category/$date` route cannot cheaply be enumerated, so it stays on 404.html. Costs a build step and needs the router to accept the prerendered shell.
2. 404.html redirect trick (rafgraph/spa-github-pages pattern: 404.html rewrites to `/?/path`, index.html restores the URL). The first response is still a 404, so it does not help `http-status-code` or Google; the current identical-copy 404.html already gives the same rendered result without redirect. No primary source fetched for this pattern: UNVERIFIED description.
3. Audit only 200 URLs: `/portdle/` plus any prerendered routes.

## 3. robots.txt and sitemap on a sub-path project site

Measured: `https://mquesada02.github.io/robots.txt` is a 404 (GitHub generic page). `/portdle/robots.txt` and `/portdle/sitemap.xml` return the 404 SPA shell.
- Google: the robots.txt goes "in the top-level directory of a site"; "Crawlers don't check for robots.txt files in subdirectories"; a 4xx is treated as no robots.txt, so no restrictions (https://developers.google.com/search/docs/crawling-indexing/robots/robots_txt). The host is `mquesada02.github.io`; only the repo `mquesada02/mquesada02.github.io` could serve the file. A `public/robots.txt` here lands at `/portdle/robots.txt` and is ignored.
- Lighthouse `is-crawlable` reads `/robots.txt` of the page origin plus meta robots and X-Robots-Tag; it fails only if all tested bots are blocked; it never reads the status (https://raw.githubusercontent.com/GoogleChrome/lighthouse/main/core/audits/seo/is-crawlable.js). Passes now.
- Sitemap: can be hosted anywhere, but without Search Console submission it "affects only descendants of the parent directory"; Search Console submission works; a `Sitemap:` line in robots.txt needs the root file (https://developers.google.com/search/docs/crawling-indexing/sitemaps/build-sitemap). `/portdle/sitemap.xml` is valid for URLs under `/portdle/`, but only useful if those routes return 200 (section 2).

## 4. Compression and HTTP versions

Measured with `Accept-Encoding: br, gzip`: gzip on HTML, JS (404,421 bytes identity, 127,516 gzip) and CSS (7,575 gzip). With `Accept-Encoding: br` only: no `content-encoding` (no Brotli). `vary: Accept-Encoding`. `HTTP/2` negotiated; HTTP/1.1 works. No `alt-svc` header, so HTTP/3 is not advertised (local curl 8.5.0 lacks `--http3`, so not tested directly: UNVERIFIED). The Pages docs do not document compression or protocol versions. Consequence: Lighthouse text-compression passes with gzip; bundle budgets should be measured at gzip size.

## 5. Limits (context)

From https://docs.github.com/en/pages/getting-started-with-github-pages/github-pages-limits: published site up to 1 GB; 100 GB/month soft bandwidth; deploy timeout 10 min; 10 builds/hour soft limit, which "does not apply if you build and publish your site with a custom GitHub Actions workflow" (the deploy job here is one); rate limiting returns 429. Design note (not cited): the CI guard should audit a local `vite preview` build, not the live URL, so it does not depend on the CDN or 600 s staleness.

## Raw measured headers (2026-11-11 ~23:59 GMT, curl 8.5.0, `Accept-Encoding: br, gzip`)

```
GET /portdle/            HTTP/2 200  content-type: text/html; charset=utf-8
  last-modified: Wed, 11 Nov 2026 23:57:17 GMT  etag: W/"6af500dd-28c"
  expires: +10 min  cache-control: max-age=600  content-encoding: gzip
  vary: Accept-Encoding  content-length: 345  via: 1.1 varnish
  strict-transport-security: max-age=31556952  access-control-allow-origin: *
GET /portdle/daily       HTTP/2 404  same etag, content-encoding: gzip, content-length: 345;
                         no cache-control, no expires, no last-modified
GET /portdle/history     HTTP/2 404  (same)
GET /portdle/archive     HTTP/2 404  (same)
GET /portdle/nonexistent HTTP/2 404  (same)
GET /portdle/robots.txt  HTTP/2 404  (same shell)
GET /portdle/sitemap.xml HTTP/2 404  (same shell)
GET /robots.txt (host root) HTTP/2 404, GitHub generic 404, content-length 5254,
  content-security-policy: default-src 'none'; style-src 'unsafe-inline'; img-src data:; connect-src 'self'
GET /portdle/assets/index-ChIMT6oR.js  HTTP/2 200  content-type: application/javascript; charset=utf-8
  etag: W/"6af500dd-62bc5"  cache-control: max-age=600  content-encoding: gzip  content-length: 127516 (identity 404421)
GET /portdle/assets/index-BxHkhQ1a.css HTTP/2 200  content-type: text/css; charset=utf-8
  etag: W/"6af500dd-979c"  cache-control: max-age=600  content-encoding: gzip  content-length: 7575
GET /portdle/privacy.html HTTP/2 200  etag: "6af500dd-128e"  cache-control: max-age=600
Accept-Encoding: br only -> no content-encoding header on the JS asset.
```
