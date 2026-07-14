'use client';

import React from 'react';
import { FILE_UPLOAD_CONFIG } from '@/config/constants';

interface AppShellProps {
  sidebar: React.ReactNode;
  children: React.ReactNode;
  fileInputRef: React.RefObject<HTMLInputElement>;
  onFileSelect: (e: React.ChangeEvent<HTMLInputElement>) => void;
}

export const AppShell: React.FC<AppShellProps> = ({
  sidebar,
  children,
  fileInputRef,
  onFileSelect,
}) => {
  return (
    <div className="flex h-[100dvh] bg-white dark:bg-[#000000] text-gray-900 dark:text-white relative overflow-hidden transition-colors duration-300">
      {/* Global hidden file input for image uploads */}
      <input
        ref={fileInputRef}
        type="file"
        accept={FILE_UPLOAD_CONFIG.acceptedTypes.join(',')}
        multiple
        onChange={onFileSelect}
        className="hidden"
      />
      {/* Animated fluid gradient background for light mode (Tahoe) */}
      <div className="absolute inset-0 z-0 opacity-100 dark:opacity-0 transition-opacity duration-700 pointer-events-none theme-tahoe-light" />

      {/* Animated fluid gradient background for dark mode */}
      <div className="absolute inset-0 z-0 opacity-0 dark:opacity-100 transition-opacity duration-700 pointer-events-none theme-claude-gradient" />

      {sidebar}

      {/* Main Content */}
      <div className="flex-1 flex flex-col min-w-0 z-10 relative bg-transparent">
        {/* Content Area */}
        <div className="flex-1 overflow-hidden flex bg-transparent relative">
          {children}
        </div>
      </div>
    </div>
  );
};
