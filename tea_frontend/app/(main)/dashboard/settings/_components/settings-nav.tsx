'use client';

import { usePathname } from 'next/navigation';
import { settingsNavigation } from '@/config';

const SettingsNav = () => {
  const path = usePathname();

  return (
    <nav className="flex overflow-x-auto py-4">
      <ul className="flex min-w-full flex-none gap-x-6 px-4 font-semibold text-foreground text-sm leading-6 sm:px-6 lg:px-8">
        {settingsNavigation.map((item) => (
          <li key={item.name}>
            <a
              className={path === item.href ? 'text-indigo-500' : ''}
              href={item.href}
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
