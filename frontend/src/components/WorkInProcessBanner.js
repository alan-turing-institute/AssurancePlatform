import React, { useState, useEffect } from "react";
import "./WorkInProcessBanner.css";

const WorkInProcessBanner = () => {
  // State to control whether the banner is shown or not
  const [isVisible, setIsVisible] = useState(true);

  useEffect(() => {
    // Check sessionStorage to determine if the banner was previously dismissed
    const isBannerDismissed =
      sessionStorage.getItem("bannerDismissed") === "true";
    setIsVisible(!isBannerDismissed);
  }, []);

  const dismissBanner = () => {
    // When dismissing the banner, set the state and also update sessionStorage
    setIsVisible(false);
    sessionStorage.setItem("bannerDismissed", "true");
  };

  // Do not render the banner if it's not supposed to be visible
  if (!isVisible) return null;

  return (
    <div className="wip-banner">
      🚧 This platform is undergoing significant changes. Please refer to our{" "}
      <a
        href="https://github.com/alan-turing-institute/AssurancePlatform"
        target="_blank"
        rel="noopener noreferrer"
      >
        project README
      </a>{" "}
      for further information. 🚧
      <button onClick={dismissBanner} className="dismiss-button">
        X
      </button>
    </div>
  );
};

export default WorkInProcessBanner;
