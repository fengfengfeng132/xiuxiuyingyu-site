import type { ButtonHTMLAttributes, PropsWithChildren } from 'react';

type Variant = 'primary' | 'secondary' | 'ghost';

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  fullWidth?: boolean;
  className?: string;
}

export function Button({ children, variant = 'primary', fullWidth, className, ...rest }: PropsWithChildren<ButtonProps>) {
  return (
    <button className={['btn', `btn-${variant}`, fullWidth ? 'btn-full' : '', className].filter(Boolean).join(' ')} {...rest}>
      {children}
    </button>
  );
}
