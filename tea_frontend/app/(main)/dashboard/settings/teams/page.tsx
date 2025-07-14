import React from 'react';
import SettingsNav from '../_components/SettingsNav';

const TeamSettings = () => {
  return (
    <main>
      <h1 className="sr-only">Account Settings</h1>

      <header className="border-b border-white/5">
        {/* Secondary navigation */}
        <SettingsNav />
      </header>
    </main>
  );
};

export default TeamSettings;
