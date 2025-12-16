import React from 'react';

interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label: string;
  error?: string;
}

const Input: React.FC<InputProps> = ({ label, error, className = '', ...props }) => {
  return (
    <div className="flex flex-col space-y-2 mb-4 w-full">
      <label className="font-display text-xs uppercase tracking-widest text-neutral-400">
        {label}
      </label>
      <input 
        className={`bg-transparent border-b border-neutral-700 py-2 text-white font-serif text-lg focus:outline-none focus:border-white transition-colors placeholder-neutral-800 ${className}`}
        {...props}
      />
      {error && <span className="text-violet-700 text-xs font-serif italic">{error}</span>}
    </div>
  );
};

export default Input;