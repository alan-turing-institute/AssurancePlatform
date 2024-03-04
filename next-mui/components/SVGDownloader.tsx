import { sanitizeForHtml } from "@/utils";

/**
 * SVGDownloader is a class for downloading the SVG of a mermaid diagram.
 */
class SVGDownloader {
  /**
   * SVGDownloader is a method for downloading the SVG of a mermaid diagram.
   *
   * @param {Object} metadata - A metadata object to be stored in the SVG as a data-metadata attribute
   * @returns {void}
   * @throws {Error} An error if the SVG element is not found.
   */
  handleDownloadSVG(metadata = null) {
    const svgElement =
      document.getElementsByClassName("mermaid")[0].childNodes[0];
    let svgData = new XMLSerializer().serializeToString(svgElement);

    // If metadata is provided, convert it to a string and store it in a data-metadata attribute
    if (metadata) {
      const metadataStr = sanitizeForHtml(JSON.stringify(metadata));
      svgData = svgData.replace(
        "<svg ",
        `<svg data-metadata='${metadataStr}' `,
      );
    }

    const blob = new Blob([svgData], { type: "image/svg+xml" });
    const url = window.URL.createObjectURL(blob);

    const a = document.createElement("a");
    a.href = url;
    a.download = "mermaid-diagram.svg";
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  }
}

export default SVGDownloader;
