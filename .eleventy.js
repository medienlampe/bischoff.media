import { readFileSync, writeFileSync } from "node:fs";
import { gzipSync } from "node:zlib";
import eleventySass from "eleventy-sass";
import Image from "@11ty/eleventy-img";

export default function(eleventyConfig) {
  // Responsive <picture> for content images: AVIF + WebP in a few widths,
  // metadata stripped (sharp default). Output is generated, not committed.
  // Usage: {% image "src/assets/img/foo.jpg", "Alt text", "(min-width: 60rem) 30rem, 100vw" %}
  eleventyConfig.addShortcode("image", async (src, alt, sizes) => {
    if (!alt) throw new Error(`Missing alt text for ${src}`);
    const metadata = await Image(src, {
      widths: [480, 960, 1440],
      formats: ["avif", "webp"],
      outputDir: "dist/assets/img/gen/",
      urlPath: "/assets/img/gen/"
    });
    return Image.generateHTML(metadata, {
      alt,
      sizes,
      loading: "lazy",
      decoding: "async"
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
