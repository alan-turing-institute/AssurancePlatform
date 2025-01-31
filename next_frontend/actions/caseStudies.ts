export const fetchCaseStudies = async (token: string) => {
  const requestOptions: RequestInit = {
    headers: {
      Authorization: `Token ${token}`,
    },
  }

  const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/case-studies/`, requestOptions)

  if(!response.ok) {
    console.error('Something went wrong fetching case studies.')
  }

  const result = await response.json()
  return result
}

export const fetchCaseStudyById = async (token: string, id: number) => {
  const requestOptions: RequestInit = {
    headers: {
      Authorization: `Token ${token}`,
    },
  }

  const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/case-studies/${id}/`, requestOptions)

  if(!response.ok) {
    console.error('Something went wrong fetching case studies.')
  }

  const result = await response.json()
  return result
}