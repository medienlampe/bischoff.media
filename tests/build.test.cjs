// Checks the built site in dist/. Run `npm test` (it builds first).
const fs = require("node:fs");
const path = require("node:path");
const zlib = require("node:zlib");

const dist = path.join(__dirname, "..", "dist");
const read = (file) => fs.readFileSync(path.join(dist, file), "utf8");
const origin = "https://bischoff.media";

const pages = {
  "index.html": { lang: "de", url: "/", indexable: true },
  "english.html": { lang: "en", url: "/english.html", indexable: true },
  "impressum.html": { lang: "de", url: "/impressum.html", indexable: false },
  "datenschutz.html": { lang: "de", url: "/datenschutz.html", indexable: false },
  "404.html": { lang: "de", url: "/404.html", indexable: false },
};

describe.each(Object.entries(pages))("%s", (file, page) => {
  const html = read(file);

  test("has language, title, description and canonical", () => {
    expect(html).toContain(`<html lang="${page.lang}">`);
    expect(html).toMatch(/<title>[^<]+<\/title>/);
    expect(html).toMatch(/<meta\s+name="description"\s+content="[^"]+"/);
    expect(html).toContain(`<link rel="canonical" href="${origin}${page.url}" />`);
  });

  test("noindex matches intent", () => {
    expect(html.includes('content="noindex, follow"')).toBe(!page.indexable);
  });

  test("has a skip link and its target", () => {
    expect(html).toContain('href="#main" class="skip-link"');
    expect(html).toContain('<main id="main"');
  });

  test("uses root paths so it also renders on nested 404 URLs", () => {
    expect(html).not.toMatch(/(?:href|src)="\.\//);
  });

  test("runs no scripts, so the strict CSP holds", () => {
    const scripts = html.match(/<script\b[^>]*>/g) || [];
    scripts.forEach((tag) => expect(tag).toContain("application/ld+json"));
    expect(html).not.toMatch(/\sstyle="/);
    expect(html).not.toMatch(/<style\b/);
  });

  test("local links and assets exist", () => {
    const refs = [...html.matchAll(/(?:href|src)="(\/[^"#?]*)/g)].map((m) => m[1]);
    refs.forEach((ref) => {
      const target = ref === "/" ? "index.html" : ref.slice(1);
      expect([ref, fs.existsSync(path.join(dist, target))]).toEqual([ref, true]);
    });
  });

  test("srcset images exist", () => {
    const sets = [...html.matchAll(/srcset="([^"]+)"/g)].map((m) => m[1]);
    sets.flatMap((set) => set.split(",").map((s) => s.trim().split(/\s+/)[0])).forEach((ref) => {
      expect([ref, fs.existsSync(path.join(dist, ref.slice(1)))]).toEqual([ref, true]);
    });
  });

  test("every image has alt text and dimensions", () => {
    const imgs = html.match(/<img\b[^>]*>/g) || [];
    imgs.forEach((tag) => {
      expect([tag, /\salt="[^"]+"/.test(tag)]).toEqual([tag, true]);
      expect([tag, /\swidth="\d+"/.test(tag) && /\sheight="\d+"/.test(tag)]).toEqual([tag, true]);
    });
  });

  test("the stylesheet URL is versioned, since it is cached for a year", () => {
    expect(html).toMatch(/href="\/assets\/css\/app\.css\?v=[0-9a-f]{10}"/);
  });

  test("only the hero photo loads eagerly (LCP), all other images lazily", () => {
    const imgs = html.match(/<img\b[^>]*>/g) || [];
    imgs.forEach((tag) => {
      const hero = tag.includes("u-photo");
      expect([tag, /loading="eager"/.test(tag) && /fetchpriority="high"/.test(tag)]).toEqual([tag, hero]);
      if (!hero) expect([tag, /loading="lazy"/.test(tag)]).toEqual([tag, true]);
    });
  });

  test("the photo does not link to the page itself", () => {
    expect(html).not.toMatch(/<a\b[^>]*>\s*<img\b[^>]*u-photo/);
  });

  test("language switcher names each language in itself", () => {
    expect(html).toMatch(/lang="de"[^>]*>Deutsch</);
    expect(html).toMatch(/lang="en"[^>]*>English</);
    expect(html).not.toContain(">Englisch<");
    expect(html).not.toContain(">German<");
  });
});

test("the CSP allows the self-hosted font", () => {
  const csp = read(".htaccess").match(/Content-Security-Policy "([^"]+)"/)[1];
  expect(csp).toContain("font-src 'self'");
  expect(csp).toContain("default-src 'none'");
});

test("fonts referenced by the stylesheet exist", () => {
  const urls = [...read("assets/css/app.css").matchAll(/url\("?(\/[^")]+)"?\)/g)].map((m) => m[1]);
  expect(urls.length).toBeGreaterThan(0);
  urls.forEach((url) => {
    expect([url, fs.existsSync(path.join(dist, url.slice(1)))]).toEqual([url, true]);
  });
});

test("JSON-LD on the home pages is valid", () => {
  ["index.html", "english.html"].forEach((file) => {
    const block = read(file).match(
      /<script type="application\/ld\+json">([\s\S]*?)<\/script>/
    );
    const data = JSON.parse(block[1]);
    expect(data["@type"]).toBe("Person");
    expect(data.sameAs.length).toBeGreaterThan(0);
  });
});

describe("sitemaps", () => {
  const indexable = Object.values(pages)
    .filter((page) => page.indexable)
    .map((page) => origin + page.url);

  test("sitemap.xml lists exactly the indexable pages", () => {
    const xml = read("sitemap.xml");
    const locs = [...xml.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => m[1]);
    expect(locs.sort()).toEqual([...indexable].sort());
    expect(xml).toMatch(/<lastmod>\d{4}-\d{2}-\d{2}<\/lastmod>/);
  });

  test("sitemap.xml.gz is the gzipped sitemap.xml", () => {
    const gz = fs.readFileSync(path.join(dist, "sitemap.xml.gz"));
    expect(zlib.gunzipSync(gz).toString("utf8")).toBe(read("sitemap.xml"));
  });

  test("urllist.txt and ror.xml list the same pages", () => {
    expect(read("urllist.txt").trim().split(/\s+/).sort()).toEqual(
      [...indexable].sort()
    );
    const ror = read("ror.xml");
    const links = [...ror.matchAll(/<item>\s*<link>([^<]+)<\/link>/g)].map((m) => m[1]);
    expect(links.sort()).toEqual([...indexable].sort());
  });
});

test("manifest icons exist", () => {
  const manifest = JSON.parse(read("manifest.json"));
  manifest.icons.forEach((icon) => {
    expect([icon.src, fs.existsSync(path.join(dist, icon.src))]).toEqual([icon.src, true]);
  });
});

test("the old service worker gets removed", () => {
  expect(read("sw.js")).toContain("registration.unregister()");
});

test("the link preview image exists and has the declared size", async () => {
  const sharp = require("sharp");
  for (const file of Object.keys(pages)) {
    const html = read(file);
    const og = html.match(/property="og:image" content="([^"]+)"/)[1];
    const tw = html.match(/name="twitter:image" content="([^"]+)"/)[1];
    expect(tw).toBe(og);
    expect(html).toContain('name="twitter:card" content="summary_large_image"');
    const width = Number(html.match(/og:image:width" content="(\d+)"/)[1]);
    const height = Number(html.match(/og:image:height" content="(\d+)"/)[1]);
    const meta = await sharp(path.join(dist, og.replace(origin, ""))).metadata();
    expect([file, meta.width, meta.height, meta.format]).toEqual([file, width, height, "jpeg"]);
  }
});
