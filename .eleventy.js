const eleventySass = require("eleventy-sass");

module.exports = function(eleventyConfig) {
  eleventyConfig.addPlugin(eleventySass);

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