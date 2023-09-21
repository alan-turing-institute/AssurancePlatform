// WorkInProcessBanner.js

import React from "react";
import "./WorkInProcessBanner.css";

const WorkInProcessBanner = () => {
  return (
    <div className="wip-banner">
      🚧 This platform is undergoing significant changes. Please refer to our
      <a
        href="https://github.com/alan-turing-institute/AssurancePlatform"
        target="_blank"
        rel="noopener noreferrer"
      >
        project README
      </a>
      for further information. 🚧
    </div>
  );
};

export default WorkInProcessBanner;
