import type { PropsWithChildren } from 'react';

interface CardProps {
  title?: string;
  subtitle?: string;
  className?: string;
}

export function Card({ title, subtitle, className, children }: PropsWithChildren<CardProps>) {
  return (
    <section className={['card', className].filter(Boolean).join(' ')}>
      {title ? <h2 className="card-title">{title}</h2> : null}
      {subtitle ? <p className="card-subtitle">{subtitle}</p> : null}
      <div>{children}</div>
    </section>
  );
}
