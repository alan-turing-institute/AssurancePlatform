'use server';

export const fetchCurrentUser = async (token: string) => {
  const requestOptions: RequestInit = {
    headers: {
      Authorization: `Token ${token}`,
    },
  };

  const response = await fetch(
    `${process.env.API_URL || process.env.NEXT_PUBLIC_API_URL}/api/user/`,
    requestOptions
  );

  if (response.status === 404 || response.status === 403) {
    console.log('Render Not Found Page');
    return;
  }

  if (response.status === 401) return null;

  const result = await response.json();
  return result;
};
