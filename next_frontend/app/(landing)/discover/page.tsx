import React from 'react'
import Patterns from '../_components/Patterns'

const DiscoverPage = () => {
  return (
    <>
      <div className="bg-white px-6 py-24 sm:py-20 lg:px-8">
        <div className="mx-auto max-w-2xl text-center">
          <p className="text-base/7 font-semibold text-indigo-600">Get the help you need</p>
          <h2 className="mt-2 text-5xl font-semibold tracking-tight text-gray-900">Community Patterns</h2>
          <p className="mt-8 text-pretty text-lg font-medium text-gray-500 sm:text-xl/8">
            Browse through all the patterns that have been created by the community.
          </p>
        </div>
      </div>

      <Patterns />
  </>
  )
}

export default DiscoverPage