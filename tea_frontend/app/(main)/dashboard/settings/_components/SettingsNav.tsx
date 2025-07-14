'use client';

import { settingsNavigation } from '@/config';
import { usePathname } from 'next/navigation';
import React from 'react';

const SettingsNav = () => {
  const path = usePathname();

  return (
    <nav className="flex overflow-x-auto py-4">
      <ul
        role="list"
        className="flex min-w-full flex-none gap-x-6 px-4 text-sm font-semibold leading-6 text-foreground sm:px-6 lg:px-8"
      >
        {settingsNavigation.map((item) => (
          <li key={item.name}>
            <a
              href={item.href}
              className={path === item.href ? 'text-indigo-500' : ''}
            >
              {item.name}
            </a>
          </li>
        ))}
      </ul>
    </nav>
  );
};

export default SettingsNav;
