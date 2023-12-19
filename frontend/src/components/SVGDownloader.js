import { sanitizeForHtml } from "./utils";

class SVGDownloader {
  handleDownloadSVG(metadata = null) {
    const svgElement =
      document.getElementsByClassName("mermaid")[0].childNodes[0];
    let svgData = new XMLSerializer().serializeToString(svgElement);

    // If metadata is provided, convert it to a string and store it in a data-metadata attribute
    if (metadata) {
      const metadataStr = sanitizeForHtml(JSON.stringify(metadata))
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
