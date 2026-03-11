export type ServiceResult<T = true> = Promise<{ data: T } | { error: string }>;
