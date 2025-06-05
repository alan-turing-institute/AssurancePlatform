import { signOut } from "next-auth/react"

export const fetchAssuranceCases = async (token: string) => {
  try {
    const myHeaders = new Headers()
    myHeaders.append("Content-Type", "application/json")
    myHeaders.append("Authorization", `Token ${token}`)

    const requestOptions: RequestInit = {
      method: 'GET',
      headers: myHeaders,
      redirect: 'follow',
    }

    const response = await fetch(
      `${process.env.NEXT_PUBLIC_API_URL ?? process.env.NEXT_PUBLIC_API_URL_STAGING}/api/cases?owner=true&view=false&edit=false&review=false`,
      requestOptions
    )

    if (response.status === 401) {
      console.log('Invalid Token')
      return null
    }

    const result = await response.json()
    return result
  } catch (error) {
    console.error("Failed to fetch assurance cases:", error)
    // redirect('/login')
    return null
  }
}

export const fetchSharedAssuranceCases = async (token: string) => {
  try {
    const myHeaders = new Headers();
    myHeaders.append("Content-Type", "application/json");
    myHeaders.append("Authorization", `Token ${token}`);

    const url = `${process.env.NEXT_PUBLIC_API_URL ?? process.env.NEXT_PUBLIC_API_URL_STAGING}/api/cases?owner=false&view=true&edit=true`

    const requestOptions: RequestInit = {
      method: 'GET',
      headers: myHeaders,
      redirect: 'follow'
    };

    const response = await fetch(url, requestOptions)

    if(response.status === 401) {
      console.log('Invalid Token')
      // localStorage.removeItem('token')
      await signOut()
      return null
    }

    const result = await response.json();
    return result
  } catch (error) {
    console.error("Failed to fetch assurance cases:", error);
    return null
  }
}

export const fetchPublishedAssuranceCases = async (token: string) => {
  try {
    const myHeaders = new Headers()
    myHeaders.append("Content-Type", "application/json")
    myHeaders.append("Authorization", `Token ${token}`)

    const requestOptions: RequestInit = {
      method: 'GET',
      headers: myHeaders,
      redirect: 'follow',
    }

    const response = await fetch(
      `${process.env.NEXT_PUBLIC_API_URL ?? process.env.NEXT_PUBLIC_API_URL_STAGING}/api/published-assurance-cases/`,
      requestOptions
    )

    if (response.status === 401) {
      console.log('Invalid Token')
      return null
    }

    const result = await response.json()
    return result
  } catch (error) {
    console.error("Failed to fetch assurance cases:", error)
    // redirect('/login')
    return null
  }
}