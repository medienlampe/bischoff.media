import { readFileSync, writeFileSync, readdirSync } from "node:fs";
import { createHash } from "node:crypto";
import { gzipSync } from "node:zlib";
import eleventySass from "eleventy-sass";
import Image from "@11ty/eleventy-img";

export default function(eleventyConfig) {
  // Responsive <picture> for content images: AVIF + WebP in a few widths,
  // metadata stripped (sharp default). Output is generated, not committed.
  // Usage: {% image "src/assets/img/foo.jpg", "Alt text", "(min-width: 60rem) 30rem, 100vw" %}
  // Above the fold (the LCP image), pass a class and `true` for eager:
  //   {% image "dist/assets/img/sb.webp", "Alt", "16rem", "u-photo", true %}
  eleventyConfig.addShortcode("image", async (src, alt, sizes, cls, eager) => {
    if (!alt) throw new Error(`Missing alt text for ${src}`);
    const metadata = await Image(src, {
      // Widths larger than the source are skipped, the source width is kept.
      widths: [480, 960, 1440],
      formats: ["avif", "webp"],
      outputDir: "dist/assets/img/gen/",
      urlPath: "/assets/img/gen/"
    });
    return Image.generateHTML(metadata, {
      alt,
      sizes,
      ...(cls ? { class: cls } : {}),
      ...(eager
        ? { loading: "eager", fetchpriority: "high" }
        : { loading: "lazy", decoding: "async" })
    });
  });

  eleventyConfig.addPlugin(eleventySass, {
    compileOptions: {
      permalink: function(contents, inputPath) {
        return (data) => {
          return data.page.filePathStem.replace(/^\/scss\//, "/css/") + ".css";
        };
      }
    }
  });

  // app.css is cached for a year (.htaccess), so its URL carries a hash of
  // the Sass sources: any style change gives returning visitors a new file.
  eleventyConfig.addGlobalData("cssVersion", () => {
    const dir = "src/assets/css";
    const hash = createHash("sha256");
    readdirSync(dir).filter((f) => f.endsWith(".scss")).sort()
      .forEach((f) => hash.update(readFileSync(`${dir}/${f}`)));
    return hash.digest("hex").slice(0, 10);
  });

  // lastmod in the sitemap comes from the last commit that touched the page.
  eleventyConfig.addGlobalData("date", "git Last Modified");

  // Pages that search engines may index: HTML output without `noindex`.
  eleventyConfig.addCollection("indexable", (collectionApi) =>
    collectionApi
      .getAll()
      .filter(
        (item) =>
          item.outputPath &&
          item.outputPath.endsWith(".html") &&
          !item.data.noindex
      )
      .sort((a, b) => a.url.localeCompare(b.url))
  );

  eleventyConfig.addFilter("isoDate", (date) =>
    new Date(date).toISOString().slice(0, 10)
  );

  eleventyConfig.on("eleventy.after", ({ dir }) => {
    const sitemap = readFileSync(`${dir.output}/sitemap.xml`);
    writeFileSync(`${dir.output}/sitemap.xml.gz`, gzipSync(sitemap));
  });

  return {
    dir: {
      input: "src",
      output: "dist"
    }
  };
};
