type Note = {
  id: string;
  type: string;
  person: { name: string; href: string };
  imageUrl: string;
  comment: string;
  date: Date;
  tags?: string[]
  assigned?: any
}