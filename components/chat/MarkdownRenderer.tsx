'use client';

import React from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import rehypeHighlight from 'rehype-highlight';
import rehypeRaw from 'rehype-raw';
import rehypeSanitize from 'rehype-sanitize';
import { cn } from '@/lib/utils';
import 'highlight.js/styles/github-dark.css';

interface MarkdownRendererProps {
  content: string;
  className?: string;
}

export const MarkdownRenderer: React.FC<MarkdownRendererProps> = ({ content, className }) => {
  return (
    <div className={cn('prose prose-sm dark:prose-invert max-w-none', className)}>
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        rehypePlugins={[rehypeHighlight, rehypeRaw, rehypeSanitize]}
        components={{
          // Custom code block styling
          code: ({ node, className, children, ...props }: any) => {
            const match = /language-(\w+)/.exec(className || '');
            const isBlock = match || String(children).includes('\n');
            return isBlock ? (
              <div className="relative group">
                <div className="absolute right-2 top-2 opacity-0 group-hover:opacity-100 transition-opacity">
                  <button
                    onClick={() => {
                      navigator.clipboard.writeText(String(children));
                    }}
                    className="px-2 py-1 text-xs bg-muted hover:bg-muted/80 rounded border text-foreground"
                  >
                    Copy
                  </button>
                </div>
                <pre className={cn('rounded-lg p-4 overflow-x-auto', className)}>
                  <code className={className} {...props}>
                    {children}
                  </code>
                </pre>
              </div>
            ) : (
              <code
                className={cn(
                  'px-1.5 py-0.5 rounded bg-muted text-foreground font-mono text-sm',
                  className
                )}
                {...props}
              >
                {children}
              </code>
            );
          },
          // Custom link styling
          a: ({ node, children, href, ...props }: any) => (
            <a
              href={href}
              target="_blank"
              rel="noopener noreferrer"
              className="text-primary hover:underline font-medium"
              {...props}
            >
              {children}
            </a>
          ),
          // Custom list styling
          ul: ({ node, children, ...props }: any) => (
            <ul className="list-disc list-outside ml-4 space-y-1" {...props}>
              {children}
            </ul>
          ),
          ol: ({ node, children, ...props }: any) => (
            <ol className="list-decimal list-outside ml-4 space-y-1" {...props}>
              {children}
            </ol>
          ),
          // Custom blockquote styling
          blockquote: ({ node, children, ...props }: any) => (
            <blockquote
              className="border-l-4 border-primary/50 pl-4 italic text-muted-foreground my-4"
              {...props}
            >
              {children}
            </blockquote>
          ),
          // Custom table styling
          table: ({ node, children, ...props }: any) => (
            <div className="overflow-x-auto my-4">
              <table className="min-w-full divide-y divide-border border rounded-lg" {...props}>
                {children}
              </table>
            </div>
          ),
          thead: ({ node, children, ...props }: any) => (
            <thead className="bg-muted" {...props}>
              {children}
            </thead>
          ),
          th: ({ node, children, ...props }: any) => (
            <th className="px-4 py-2 text-left text-sm font-semibold" {...props}>
              {children}
            </th>
          ),
          td: ({ node, children, ...props }: any) => (
            <td className="px-4 py-2 text-sm border-t" {...props}>
              {children}
            </td>
          ),
          // Custom heading styling
          h1: ({ node, children, ...props }: any) => (
            <h1 className="text-2xl font-bold mt-6 mb-4 text-foreground" {...props}>
              {children}
            </h1>
          ),
          h2: ({ node, children, ...props }: any) => (
            <h2 className="text-xl font-bold mt-5 mb-3 text-foreground" {...props}>
              {children}
            </h2>
          ),
          h3: ({ node, children, ...props }: any) => (
            <h3 className="text-lg font-semibold mt-4 mb-2 text-foreground" {...props}>
              {children}
            </h3>
          ),
          // Custom paragraph styling
          p: ({ node, children, ...props }: any) => (
            <p className="mb-3 leading-relaxed text-foreground" {...props}>
              {children}
            </p>
          ),
          // Custom hr styling
          hr: ({ node, ...props }: any) => (
            <hr className="my-4 border-border" {...props} />
          ),
        }}
      >
        {content}
      </ReactMarkdown>
    </div>
  );
};
