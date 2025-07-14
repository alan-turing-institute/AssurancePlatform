/**
 * Domain types for the TEA Platform
 * These interfaces represent the core business entities
 */

export interface CaseStudy {
  id: number;
  title: string;
  description: string;
  sector: string;
  published: boolean;
  publishedDate?: string;
  createdOn: string;
  authors: string;
  image?: string;
  featuredImage?: string;
}

export interface AssuranceCase {
  id: number;
  name: string;
  title?: string; // Some components use title instead of name
  description?: string;
  published?: boolean;
  createdOn?: string;
  updatedOn?: string;
}

export interface User {
  id: number;
  username: string;
  email: string;
  firstName?: string;
  lastName?: string;
  createdAt: string;
  updatedAt?: string;
}

export interface FormFile {
  file: File;
  preview: string;
}

export interface ApiResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
}

// Form-related types
export interface CaseStudyFormData {
  title: string;
  description: string;
  sector: string;
  authors: string;
  published: boolean;
  publishedDate?: string;
  image?: File;
  selectedAssuranceCases: number[];
}

export interface FileUploadEvent extends Event {
  target: HTMLInputElement & {
    files: FileList;
  };
}

// Component prop types
export interface TableActionsProps {
  caseStudy: CaseStudy;
}

export interface RelatedAssuranceCaseListProps {
  published: boolean;
  selectedAssuranceCases: number[];
  setSelectedAssuranceCases: React.Dispatch<React.SetStateAction<number[]>>;
}

export interface CaseStudyFormProps {
  caseStudy?: CaseStudy;
}

export interface PublishedBannerProps {
  caseStudy: CaseStudy;
}

export interface DeleteFormProps {
  user: User;
}

export interface PasswordFormProps {
  data: User;
}

export interface PersonalInfoFormProps {
  data: User;
}

export interface CaseStudiesProps {
  caseStudies: CaseStudy[];
}
