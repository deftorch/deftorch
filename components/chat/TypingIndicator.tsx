'use client';

import React from 'react';
import { Loader2 } from 'lucide-react';

export const TypingIndicator: React.FC = () => {
  return (
    <div className="flex gap-4 px-4 py-6 bg-muted/30">
      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-accent text-accent-foreground">
        <Loader2 className="h-4 w-4 animate-spin" />
      </div>
      <div className="flex items-center gap-1 pt-2">
        <div className="h-2 w-2 rounded-full bg-muted-foreground animate-typing" style={{ animationDelay: '0s' }} />
        <div className="h-2 w-2 rounded-full bg-muted-foreground animate-typing" style={{ animationDelay: '0.2s' }} />
        <div className="h-2 w-2 rounded-full bg-muted-foreground animate-typing" style={{ animationDelay: '0.4s' }} />
      </div>
    </div>
  );
};
