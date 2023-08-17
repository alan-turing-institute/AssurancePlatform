let webVitalsModule;

import("web-vitals").then((module) => {
  webVitalsModule = module;
});

const reportWebVitals = (onPerfEntry) => {
  if (webVitalsModule && onPerfEntry && onPerfEntry instanceof Function) {
    const { getCLS, getFID, getFCP, getLCP, getTTFB } = webVitalsModule;
    getCLS(onPerfEntry);
    getFID(onPerfEntry);
    getFCP(onPerfEntry);
    getLCP(onPerfEntry);
    getTTFB(onPerfEntry);
  }
};

export default reportWebVitals;
