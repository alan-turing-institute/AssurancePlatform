'use server'

import { revalidatePath } from "next/cache"

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

export const fetchPublishedCaseStudies = async () => {
  const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/case-studies?published=true`)

  if(!response.ok) {
    console.error('Something went wrong fetching case studies.')
  }

  const { results } = await response.json()
  return results
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

export const createCaseStudy = async (token: string | undefined, newCaseStudy: any) => {
  if(!token) return null

  const requestOptions: RequestInit = {
    method: 'POST',
    headers: {
      "Content-Type": "application/json", // 👈 Required!
      "Accept": "application/json",  // 👈 Optional, but good practice
      Authorization: `Token ${token}`,
    },
    body: JSON.stringify(newCaseStudy),
  }

  const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/case-studies/`, requestOptions)
  console.log(response)

  if(!response.ok) {
    console.error('Something went wrong creating case study')
  }
  
  revalidatePath('/dashboard/case-studies')
  return true

}

export const updateCaseStudy = async (token: string | undefined, caseStudy: any) => {
  if(!token) return false

  const requestOptions: RequestInit = {
    method: 'PUT',
    headers: {
      "Content-Type": "application/json", // 👈 Required!
      "Accept": "application/json",  // 👈 Optional, but good practice
      Authorization: `Token ${token}`,
    },
    body: JSON.stringify(caseStudy),
  }

  const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/case-studies/${caseStudy.id}/`, requestOptions)
  console.log(response)

  if(!response.ok) {
    console.error('Something went wrong fetching case studies.')
    return false
  }

  revalidatePath(`/dashboard/case-studies/${caseStudy.id}`)
  return true
}

export const deleteCaseStudy = async (token: string, caseStudyId: number) => {
  const requestOptions: RequestInit = {
    method: 'DELETE',
    headers: {
      Authorization: `Token ${token}`,
    }
  }

  const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/case-studies/${caseStudyId}/`, requestOptions)

  if(!response.ok) {
    console.error('Something went wrong deleting case study.')
    return false
  }

  revalidatePath('/dashboard/case-studies')
  return true
}