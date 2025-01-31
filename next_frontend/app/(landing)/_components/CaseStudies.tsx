'use client'

import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { caseStudies } from '@/config';
import moment from 'moment';
import { useState } from 'react';

function CaseStudies() {
  const [searchKeyword, setSearchKeyword] = useState('');
  const [selectedSector, setSelectedSector] = useState('');

  const sectors = Array.from(new Set(caseStudies.map((caseStudy) => caseStudy.sector).filter(Boolean)));

  const filteredCaseStudies = caseStudies
  .filter((caseStudy) => caseStudy.published)
  .filter((caseStudy) => 
    (searchKeyword === '' || caseStudy.title.toLowerCase().includes(searchKeyword.toLowerCase())) &&
    (selectedSector === 'all' || selectedSector === '' || caseStudy.sector === selectedSector)
  );

  return (
    <>
      <div className="text-black mb-24 mx-auto max-w-2xl">
        <div className="flex items-center gap-4">
          {/* Search Bar */}
          <Input
            type="text"
            placeholder="Search patterns..."
            className="bg-gray-100 h-12 border-gray-100 ring-offset-indigo-500"
            value={searchKeyword}
            onChange={(e) => setSearchKeyword(e.target.value)}
          />

          {/* Sector Filter */}
          <Select
            value={selectedSector}
            onValueChange={(value) => setSelectedSector(value)}
          >
            <SelectTrigger className="w-56 bg-gray-100 border border-gray-100 rounded-lg shadow-sm focus:ring focus:ring-indigo-200 focus:border-indigo-500">
              <SelectValue placeholder="Select a sector" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Sectors</SelectItem>
              {sectors.map((sector) => (
                <SelectItem key={sector} value={sector}>
                  {sector}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="mx-auto max-w-7xl px-6 lg:px-8 pb-28">
        <div className="mx-auto grid max-w-2xl grid-cols-1 gap-x-8 gap-y-20 lg:mx-0 lg:max-w-none lg:grid-cols-3">
          {filteredCaseStudies.length > 0 ? (
            filteredCaseStudies.map((caseStudy) => (
              <article key={caseStudy.id} className="flex flex-col items-start justify-between">
                <div className="relative w-full">
                  <img
                    alt=""
                    src={caseStudy.image ?? ''}
                    className="aspect-video w-full rounded-2xl bg-gray-100 object-cover sm:aspect-[2/1] lg:aspect-[3/2]"
                  />
                  <div className="absolute inset-0 rounded-2xl ring-1 ring-inset ring-gray-900/10" />
                </div>
                <div className="max-w-xl">
                  <div className="mt-8 flex items-center gap-x-4 text-xs">
                    <time className="text-gray-500">
                      {moment(caseStudy.publishedDate).format('DD/MM/YYYY')}
                    </time>
                    <p className="text-black">{caseStudy.sector}</p>
                  </div>
                  <div className="group relative">
                    <h3 className="mt-3 text-lg/6 font-semibold text-gray-900 group-hover:text-gray-600">
                      <a href={'#'}>
                        <span className="absolute inset-0" />
                        {caseStudy.title}
                      </a>
                    </h3>
                    <p className="mt-5 line-clamp-3 text-sm/6 text-gray-600">{caseStudy.description}</p>
                  </div>
                  <div className="relative mt-8 flex items-center gap-x-4">
                    <img
                      alt=""
                      src={'https://avatars.githubusercontent.com/u/63010234?v=4'}
                      className="size-10 rounded-full bg-gray-100"
                    />
                    <div className="text-sm/6">
                      <p className="font-semibold text-gray-900">
                        <a href={'#'}>
                          <span className="absolute inset-0" />
                          {caseStudy.authors}
                        </a>
                      </p>
                      <p className="text-gray-600">@ChrisBurrTuring</p>
                    </div>
                  </div>
                </div>
              </article>
            ))
          ) : (
            <p className="text-gray-600">No Case Studies match your search criteria.</p>
          )}
        </div>
      </div>
    </>
  );
}

export default CaseStudies;
