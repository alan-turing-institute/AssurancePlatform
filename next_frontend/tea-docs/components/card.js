import { FileTextIcon } from "lucide-react"

export const CardComponent = ({ title, description, url }) => {
  return (
    <a href={url} style={{ textDecoration: 'none' }}>
      <div className="bg-gray-100/50 dark:bg-slate-900 p-6 rounded-lg group hover:bg-indigo-500 dark:hover:bg-indigo-600 hover:cursor-pointer transition-all duration-300">
        <div className="flex justify-start items-center gap-2 mb-2">
          <FileTextIcon className="size-5 group-hover:text-white transition-all duration-300"/>
          <div className="text-xl font-semibold group-hover:text-white transition-all duration-300">{title}</div>
        </div>
        <div className="text-muted-foreground text-sm group-hover:text-white transition-all duration-300">{description}</div>
      </div>
    </a>
  )
}