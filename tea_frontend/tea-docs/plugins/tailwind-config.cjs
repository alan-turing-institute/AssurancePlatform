"use strict";
function tailwindPlugin(_context, _options) {
	return {
		name: "tailwind-plugin",
		configurePostCss(postcssOptions) {
			postcssOptions.plugins = [
				require("postcss-import"),
				require("tailwindcss"),
				require("autoprefixer"),
			];
			return postcssOptions;
		},
	};
}

module.exports = tailwindPlugin;
