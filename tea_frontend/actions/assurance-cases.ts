'use server';

export const fetchAssuranceCases = async (token: string) => {
  try {
    const myHeaders = new Headers();
    myHeaders.append('Content-Type', 'application/json');
    myHeaders.append('Authorization', `Token ${token}`);

    const requestOptions: RequestInit = {
      method: 'GET',
      headers: myHeaders,
      redirect: 'follow',
    };

    const response = await fetch(
      `${(process.env.API_URL || process.env.NEXT_PUBLIC_API_URL) ?? (process.env.API_URL_STAGING || process.env.NEXT_PUBLIC_API_URL_STAGING)}/api/cases?owner=true&view=false&edit=false&review=false`,
      requestOptions
    );

    if (response.status === 401) {
      return null;
    }

    const result = await response.json();
    return result;
  } catch (_error) {
    // redirect('/login')
    return null;
  }
};

export const fetchSharedAssuranceCases = async (token: string) => {
  try {
    const myHeaders = new Headers();
    myHeaders.append('Content-Type', 'application/json');
    myHeaders.append('Authorization', `Token ${token}`);

    const url = `${(process.env.API_URL || process.env.NEXT_PUBLIC_API_URL) ?? (process.env.API_URL_STAGING || process.env.NEXT_PUBLIC_API_URL_STAGING)}/api/cases?owner=false&view=true&edit=true`;

    const requestOptions: RequestInit = {
      method: 'GET',
      headers: myHeaders,
      redirect: 'follow',
    };

    const response = await fetch(url, requestOptions);

    if (response.status === 401) {
      // localStorage.removeItem('token')
      // await signOut() // TODO: Handle signOut differently in server action
      return null;
    }

    const result = await response.json();
    return result;
  } catch (_error) {
    return null;
  }
};

export const fetchPublishedAssuranceCases = async (token: string) => {
  try {
    const myHeaders = new Headers();
    myHeaders.append('Content-Type', 'application/json');
    myHeaders.append('Authorization', `Token ${token}`);

    const requestOptions: RequestInit = {
      method: 'GET',
      headers: myHeaders,
      redirect: 'follow',
    };

    const response = await fetch(
      `${(process.env.API_URL || process.env.NEXT_PUBLIC_API_URL) ?? (process.env.API_URL_STAGING || process.env.NEXT_PUBLIC_API_URL_STAGING)}/api/published-assurance-cases/`,
      requestOptions
    );

    if (response.status === 401) {
      return null;
    }

    const result = await response.json();
    return result;
  } catch (_error) {
    // redirect('/login')
    return null;
  }
};
