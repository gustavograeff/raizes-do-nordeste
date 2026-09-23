import type { ButtonHTMLAttributes, ReactNode } from 'react';
import { Link } from 'react-router-dom';
import type { LinkProps } from 'react-router-dom';

/** Estilo de campo de texto, compartilhado pelos formulários de cadastro, balcão e painel. */
export const FIELD_CLASS =
  'rounded-lg border border-palha bg-white px-3 py-2 outline-none transition focus:border-barro';

type Variant = 'primary' | 'secondary' | 'danger';

const VARIANT_CLASS: Record<Variant, string> = {
  primary:
    'bg-barro text-white shadow-md shadow-barro/30 hover:bg-barro-escuro hover:shadow-lg disabled:bg-stone-300 disabled:shadow-none disabled:cursor-not-allowed',
  secondary: 'border border-palha bg-white text-barro-escuro shadow-sm hover:border-barro hover:bg-areia',
  danger: 'border border-red-300 bg-white text-red-800 shadow-sm hover:border-red-500 hover:bg-red-50',
};

const BUTTON_BASE_CLASS =
  'inline-flex items-center justify-center gap-2 rounded-xl px-5 py-3 text-sm font-bold transition duration-150 active:scale-[0.98]';

function buttonClass(variant: Variant, className: string): string {
  return `${BUTTON_BASE_CLASS} ${VARIANT_CLASS[variant]} ${className}`.trim();
}

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant };

export function Button({ variant = 'primary', className = '', ...props }: ButtonProps) {
  return <button className={buttonClass(variant, className)} {...props} />;
}

type LinkButtonProps = LinkProps & { variant?: Variant };

export function LinkButton({ variant = 'primary', className = '', ...props }: LinkButtonProps) {
  return <Link className={buttonClass(variant, className)} {...props} />;
}

type CardProps = { className?: string; children: ReactNode };

export function Card({ className = '', children }: CardProps) {
  return (
    <div className={`rounded-2xl border border-palha bg-white p-4 shadow-sm shadow-barro-escuro/5 ${className}`}>
      {children}
    </div>
  );
}

type PageHeaderProps = { title: string; description?: ReactNode };

export function PageHeader({ title, description }: PageHeaderProps) {
  return (
    <div>
      <h1 className="text-3xl font-bold text-barro-escuro">{title}</h1>
      {description !== undefined && <p className="mt-2 max-w-2xl text-stone-600">{description}</p>}
    </div>
  );
}

type SectionTitleProps = { className?: string; children: ReactNode };

export function SectionTitle({ className = '', children }: SectionTitleProps) {
  return <h2 className={`text-lg font-bold text-barro-escuro ${className}`}>{children}</h2>;
}
