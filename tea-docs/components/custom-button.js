import { MoveRightIcon } from 'lucide-react';

export const CustomButton = ({ children, url }) => {
  return (
    <a
      className="my-3 inline-flex items-center justify-center gap-2 rounded-md bg-indigo-600 px-4 py-2 text-white hover:cursor-pointer hover:bg-indigo-700 hover:text-white hover:no-underline"
      href={url}
      target="_blank"
    >
      {children}
      <MoveRightIcon className="size-4" />
    </a>
  );
};
