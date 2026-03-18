import type { ButtonHTMLAttributes, PropsWithChildren } from 'react';

type Variant = 'primary' | 'secondary' | 'ghost';

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  fullWidth?: boolean;
}

export function Button({ children, variant = 'primary', fullWidth, ...rest }: PropsWithChildren<ButtonProps>) {
  return (
    <button className={`btn btn-${variant} ${fullWidth ? 'btn-full' : ''}`} {...rest}>
      {children}
    </button>
  );
}
