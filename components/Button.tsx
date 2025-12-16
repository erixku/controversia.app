import React from 'react';

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'outline' | 'ghost';
  fullWidth?: boolean;
}

const Button: React.FC<ButtonProps> = ({ 
  children, 
  variant = 'primary', 
  fullWidth = false, 
  className = '', 
  ...props 
}) => {
  const baseStyles = "px-8 py-3 font-display font-bold text-sm tracking-widest uppercase transition-all duration-300 disabled:opacity-50";
  
  const variants = {
    primary: "bg-white text-black hover:bg-neutral-200 border border-white",
    outline: "bg-transparent text-white border border-white hover:bg-white hover:text-black",
    ghost: "bg-transparent text-white hover:text-neutral-300 underline-offset-4 hover:underline"
  };

  const widthStyle = fullWidth ? "w-full" : "";

  return (
    <button 
      className={`${baseStyles} ${variants[variant]} ${widthStyle} ${className}`} 
      {...props}
    >
      {children}
    </button>
  );
};

export default Button;