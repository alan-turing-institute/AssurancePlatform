import React from 'react';
import SettingsNav from '../_components/SettingsNav';

const TeamSettings = () => {
  return (
    <main>
      <h1 className="sr-only">Account Settings</h1>

      <header className="border-white/5 border-b">
        {/* Secondary navigation */}
        <SettingsNav />
      </header>
    </main>
  );
};

export default TeamSettings;
