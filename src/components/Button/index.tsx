import React from 'react';
import './index.css';

export type ButtonVariant = 'primary' | 'secondary' | 'danger' | 'default';
export type ButtonSize = 'md' | 'sm';

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
    variant?: ButtonVariant;
    size?: ButtonSize;
    fullWidth?: boolean;
}

export const Button: React.FC<ButtonProps> = ({
  variant = 'default',
  size = 'md',
  fullWidth = false,
  className = '',
  ...props
}) => {
  return (
    <button
      className={`btn btn-${variant} btn-${size}${fullWidth ? ' btn-full' : ''} ${className}`.trim()}
      {...props}
    />
  );
}; 