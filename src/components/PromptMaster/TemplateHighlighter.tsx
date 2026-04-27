import React from 'react';

interface TemplateHighlighterProps {
  text: string;
  className?: string;
}

/**
 * Specialized component to render text with highlighted {{variable}} definitions.
 * Handles standard variables and those with default values like {{var:default}}.
 */
export const TemplateHighlighter: React.FC<TemplateHighlighterProps> = ({ text, className = '' }) => {
  // Regex to match {{variable}} or {{variable:default}}
  // Captures the variable including the braces
  const regex = /({{[^}]+}})/g;
  
  const parts = text.split(regex);

  return (
    <div className={`whitespace-pre-wrap font-mono ${className}`}>
      {parts.map((part, index) => {
        if (part.match(regex)) {
          return (
            <span 
              key={index} 
              className="text-indigo-400 font-bold bg-indigo-500/10 px-1 rounded-md border border-indigo-500/20 shadow-[0_0_10px_rgba(129,140,248,0.1)] transition-all animate-pulse-subtle"
            >
              {part}
            </span>
          );
        }
        return <span key={index}>{part}</span>;
      })}
    </div>
  );
};

// Add a subtle pulse animation to variables
const style = document.createElement('style');
style.innerHTML = `
  @keyframes pulse-subtle {
    0%, 100% { opacity: 1; }
    50% { opacity: 0.8; }
  }
  .animate-pulse-subtle {
    animation: pulse-subtle 3s ease-in-out infinite;
  }
`;
if (typeof document !== 'undefined') {
    document.head.appendChild(style);
}
