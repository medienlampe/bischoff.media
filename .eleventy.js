import eleventySass from "eleventy-sass";
import UpgradeHelper from "@11ty/eleventy-upgrade-help";

export default function(eleventyConfig) {
  eleventyConfig.addPlugin(eleventySass, {
    compileOptions: {
      permalink: function(contents, inputPath) {
        return (data) => {
          return data.page.filePathStem.replace(/^\/scss\//, "/css/") + ".css";
        };
      }
    }
  });

  return {
    dir: {
      input: "src",
      output: "dist"
    }
  };
};