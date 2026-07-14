import React, { useState, useRef, useEffect, useMemo } from 'react';
import { Search, ChevronUp, ChevronDown, X } from 'lucide-react';

interface CodeEditorProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
}

export const CodeEditor: React.FC<CodeEditorProps> = ({
  value,
  onChange,
  placeholder = '// Code will appear here...',
}) => {
  const [showSearch, setShowSearch] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [currentMatchIndex, setCurrentMatchIndex] = useState(-1);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);

  // Find all matches
  const matches = useMemo(() => {
    if (!searchQuery) return [];
    const lowerValue = value.toLowerCase();
    const lowerQuery = searchQuery.toLowerCase();
    const foundMatches: number[] = [];
    let i = 0;
    while (i < lowerValue.length) {
      const idx = lowerValue.indexOf(lowerQuery, i);
      if (idx === -1) break;
      foundMatches.push(idx);
      i = idx + lowerQuery.length;
    }
    return foundMatches;
  }, [value, searchQuery]);

  // Select the current match in the textarea
  useEffect(() => {
    if (matches.length > 0 && currentMatchIndex >= 0 && currentMatchIndex < matches.length) {
      const start = matches[currentMatchIndex];
      const end = start + searchQuery.length;
      if (textareaRef.current) {
        textareaRef.current.focus();
        textareaRef.current.setSelectionRange(start, end);
        // Scroll to selection (browser behavior handles this mostly, but we can enforce it)
        const fullTextBeforeMatch = value.substring(0, start);
        const lines = fullTextBeforeMatch.split('\n');
        const lineHeight = 20; // approximate line height
        textareaRef.current.scrollTop = Math.max(0, (lines.length - 2) * lineHeight);
      }
    }
  }, [currentMatchIndex, matches, searchQuery.length, value]);

  // Handle Ctrl+F / Cmd+F to open search
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'f') {
        e.preventDefault();
        setShowSearch(true);
        setTimeout(() => searchInputRef.current?.focus(), 50);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  const handleNextMatch = () => {
    if (matches.length > 0) {
      setCurrentMatchIndex((prev) => (prev + 1) % matches.length);
    }
  };

  const handlePrevMatch = () => {
    if (matches.length > 0) {
      setCurrentMatchIndex((prev) => (prev - 1 + matches.length) % matches.length);
    }
  };

  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setSearchQuery(e.target.value);
    setCurrentMatchIndex(e.target.value ? 0 : -1);
  };

  const closeSearch = () => {
    setShowSearch(false);
    setSearchQuery('');
    setCurrentMatchIndex(-1);
    textareaRef.current?.focus();
  };

  return (
    <div className="h-full flex flex-col relative bg-gray-900">
      {/* Search Bar Overlay */}
      {showSearch && (
        <div className="absolute top-4 right-4 z-10 flex items-center gap-2 bg-[#1e293b] text-gray-200 p-1.5 rounded-lg border border-gray-700 shadow-xl animate-fade-in w-[300px]">
          <Search size={14} className="ml-2 text-gray-400" />
          <input
            ref={searchInputRef}
            type="text"
            value={searchQuery}
            onChange={handleSearchChange}
            placeholder="Find in code..."
            className="flex-1 bg-transparent border-none outline-none text-sm px-1 placeholder-gray-500"
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.shiftKey ? handlePrevMatch() : handleNextMatch();
              } else if (e.key === 'Escape') {
                closeSearch();
              }
            }}
          />
          {searchQuery && (
            <span className="text-xs text-gray-500 mr-2 tabular-nums">
              {matches.length > 0 ? currentMatchIndex + 1 : 0}/{matches.length}
            </span>
          )}
          <div className="flex items-center border-l border-gray-700 pl-1">
            <button
              onClick={handlePrevMatch}
              disabled={matches.length === 0}
              className="p-1 hover:bg-gray-700 rounded text-gray-400 disabled:opacity-50"
            >
              <ChevronUp size={14} />
            </button>
            <button
              onClick={handleNextMatch}
              disabled={matches.length === 0}
              className="p-1 hover:bg-gray-700 rounded text-gray-400 disabled:opacity-50"
            >
              <ChevronDown size={14} />
            </button>
            <button onClick={closeSearch} className="p-1 hover:bg-gray-700 rounded text-gray-400 ml-1">
              <X size={14} />
            </button>
          </div>
        </div>
      )}

      {/* Floating Toggle Search Button if closed */}
      {!showSearch && (
        <button
          onClick={() => setShowSearch(true)}
          className="absolute top-4 right-4 z-10 p-2 bg-[#1e293b] text-gray-400 hover:text-gray-200 rounded-lg border border-gray-700 shadow-md hover:bg-gray-700 transition-colors"
          title="Search in code (Ctrl+F)"
        >
          <Search size={16} />
        </button>
      )}

      {/* Editor Textarea */}
      <textarea
        ref={textareaRef}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="flex-1 w-full bg-transparent text-gray-100 p-4 font-mono text-sm resize-none focus:outline-none selection:bg-[#2563eb] selection:text-white leading-[20px]"
        spellCheck={false}
      />
    </div>
  );
};
