import React from 'react';
import useBaseUrl from '@docusaurus/useBaseUrl';

const ImageList = ({ title, description, images = [] }) => {
  return (
    <div className="my-6">
      {title && <h3 className="text-xl font-semibold mb-2">{title}</h3>}
      {description && <p className="text-gray-600 mb-4">{description}</p>}
      <div className="flex flex-wrap gap-4">
        {images.map((img, index) => (
          <img
            key={index}
            src={useBaseUrl(img)}
            alt={`Image ${index + 1}`}
            className="aspect-video rounded-md w-1/3 h-auto shadow-md"
          />
        ))}
      </div>
    </div>
  );
};

export default ImageList;
