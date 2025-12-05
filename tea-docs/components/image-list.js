import useBaseUrl from "@docusaurus/useBaseUrl";

const ImageList = ({ title, description, images = [] }) => (
	<div className="my-6">
		{title && <h3 className="mb-2 font-semibold text-xl">{title}</h3>}
		{description && <p className="mb-4 text-gray-600">{description}</p>}
		<div className="flex flex-wrap gap-4">
			{images.map((img, index) => (
				<img
					alt={`Image ${index + 1}`}
					className="aspect-video h-auto w-1/3 rounded-md shadow-md"
					key={index}
					src={useBaseUrl(img)}
				/>
			))}
		</div>
	</div>
);

export default ImageList;
