import mermaid from "mermaid";
import { FC, useEffect } from "react";
import { TransformComponent, TransformWrapper } from "react-zoom-pan-pinch";

import "./Mermaid.scss";

interface IMermaid {
  chart: string;
  name: string;
}

export const Mermaid: FC<IMermaid> = ({ chart, name }) => {
  useEffect(() => {
    if (chart) {
      mermaid.initialize({
        theme: "base",
        logLevel: 1,
        securityLevel: "loose",
        flowchart: {
          useMaxWidth: true,
          htmlLabels: true,
          curve: "basis",
        },
        themeVariables: {
          primaryColor: "#ffffff",
          nodeBorder: "#000000",
          defaultLinkColor: "#004990",
          fontFamily: "arial",
        },
      });
      mermaid.contentLoaded();
    }
  }, [chart]);

  const exportSvg = async () => {
    const svgData = await mermaid.render("text1", chart);

    const svgBlob = new Blob([svgData.svg], {
      type: "image/svg_xml;charset=utf-8",
    });

    const svgUrl = URL.createObjectURL(svgBlob);

    const downloadLink = document.createElement("a");
    downloadLink.href = svgUrl;
    downloadLink.download = `${name}.svg`;
    document.body.appendChild(downloadLink);
    downloadLink.click();
    document.body.removeChild(downloadLink);
  };

  const copyMermaidCode = async () => {
    await navigator.clipboard.writeText(chart);
    alert("Mermaid Code" + chart);
  };

  return (
    // <div className="relative w-full flex justify-center">
    //   <div className="absolute right-1 bottom-1 m-2 z-50 dropdown dropdown-end">
    //     <label tabIndex={0} className="btn btn-success m-1">
    //       Export
    //     </label>
    //     <ul
    //       tabIndex={0}
    //       className="dropdown-content menu p-2 shadow bg-gray-700 rounded-box w-52"
    //     >
    //       <li>
    //         <button onClick={copyMermaidCode}>Copy Mermaid Code</button>
    //       </li>
    //       <li>
    //         <button onClick={exportSvg}>SVG</button>
    //       </li>
    //     </ul>
    //   </div>

    //   <TransformWrapper>
    //     <TransformComponent contentClass="w-full" wrapperClass="w-full h-full">
    //       <div className="mermaid w-full mb-100">{chart}</div>
    //     </TransformComponent>{" "}
    //   </TransformWrapper>
    // </div>
    <div
      style={{
        display: "flex",
        margin: '0 auto',
        flexDirection: "column",
        height: "100%",
        width: "100%",
        justifyContent: "start",
        alignItems: "center",
        overflow: "visible",
      }}
      className='mermaid'
    >
      {chart}
    </div>
  );
};
