import React from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

const markdownComponents = {
  // Headings
  h1: ({ children }) => <h1 className="text-xl font-bold text-slate-900 mb-3 mt-4 pb-2 border-b border-slate-200">{children}</h1>,
  h2: ({ children }) => <h2 className="text-lg font-bold text-slate-800 mb-2 mt-4">{children}</h2>,
  h3: ({ children }) => <h3 className="text-base font-bold text-slate-800 mb-2 mt-3">{children}</h3>,
  h4: ({ children }) => <h4 className="text-sm font-bold text-slate-700 mb-1.5 mt-2">{children}</h4>,

  // Paragraphs
  p: ({ children }) => <p className="text-sm leading-relaxed text-slate-700 mb-2 last:mb-0">{children}</p>,

  // Lists
  ul: ({ children }) => <ul className="list-disc pl-5 space-y-1 mb-3 text-sm text-slate-700">{children}</ul>,
  ol: ({ children }) => <ol className="list-decimal pl-5 space-y-1 mb-3 text-sm text-slate-700">{children}</ol>,
  li: ({ children }) => <li className="leading-relaxed">{children}</li>,

  // Bold & Italic
  strong: ({ children }) => <strong className="font-bold text-slate-900">{children}</strong>,
  em: ({ children }) => <em className="italic text-slate-600">{children}</em>,

  // Code
  code: ({ inline, className: codeCls, children }) => {
    if (inline) {
      return <code className="bg-violet-50 text-violet-700 px-1.5 py-0.5 rounded text-xs font-mono font-semibold border border-violet-100">{children}</code>;
    }
    return (
      <pre className="bg-slate-900 text-slate-100 rounded-lg p-3 my-2 overflow-x-auto text-xs font-mono leading-relaxed">
        <code>{children}</code>
      </pre>
    );
  },

  // Blockquote
  blockquote: ({ children }) => (
    <blockquote className="border-l-4 border-violet-300 bg-violet-50/50 pl-4 py-2 my-2 rounded-r-lg text-sm italic text-slate-600">
      {children}
    </blockquote>
  ),

  // Table
  table: ({ children }) => (
    <div className="overflow-x-auto my-3">
      <table className="min-w-full text-sm border border-slate-200 rounded-lg overflow-hidden">{children}</table>
    </div>
  ),
  thead: ({ children }) => <thead className="bg-slate-100">{children}</thead>,
  tbody: ({ children }) => <tbody className="divide-y divide-slate-100">{children}</tbody>,
  tr: ({ children }) => <tr className="hover:bg-slate-50">{children}</tr>,
  th: ({ children }) => <th className="px-3 py-2 text-left font-bold text-slate-700 text-xs uppercase tracking-wider">{children}</th>,
  td: ({ children }) => <td className="px-3 py-2 text-slate-600">{children}</td>,

  // Horizontal Rule
  hr: () => <hr className="my-4 border-slate-200" />,

  // Links
  a: ({ href, children }) => (
    <a href={href} target="_blank" rel="noopener noreferrer" className="text-violet-600 hover:text-violet-800 underline underline-offset-2 font-medium">
      {children}
    </a>
  ),
};

/**
 * Beautiful Markdown Renderer for AI responses.
 * Renders markdown with proper styling for headings, lists, code blocks, tables, etc.
 */
const MarkdownRenderer = ({ children, className = '' }) => {
  if (!children) return null;

  return (
    <div className={`markdown-body ${className}`}>
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={markdownComponents}
      >
        {children}
      </ReactMarkdown>
    </div>
  );
};

export default MarkdownRenderer;
