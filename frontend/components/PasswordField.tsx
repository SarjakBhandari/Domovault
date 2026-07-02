'use client';

import { useId, useState } from 'react';

type PasswordFieldProps = {
  label: string;
  name: string;
  value: string;
  onChange: (value: string) => void;
  autoComplete: string;
  required?: boolean;
  minLength?: number;
  helpText?: string;
};

export default function PasswordField({
  label,
  name,
  value,
  onChange,
  autoComplete,
  required,
  minLength,
  helpText,
}: PasswordFieldProps) {
  const [visible, setVisible] = useState(false);
  const inputId = useId();
  const helpId = useId();

  return (
    <div>
      <label htmlFor={inputId} className="block text-sm font-medium text-slate-700">
        {label}
      </label>
      <div className="mt-1 flex rounded-md border border-slate-300 focus-within:border-brand-600">
        <input
          id={inputId}
          name={name}
          type={visible ? 'text' : 'password'}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          autoComplete={autoComplete}
          required={required}
          minLength={minLength}
          aria-describedby={helpText ? helpId : undefined}
          className="w-full rounded-md border-0 px-3 py-2 text-sm focus:outline-none"
        />
        <button
          type="button"
          onClick={() => setVisible((v) => !v)}
          aria-pressed={visible}
          className="px-3 text-xs font-medium text-slate-500 hover:text-brand-700"
        >
          {visible ? 'Hide' : 'Show'}
          <span className="sr-only"> password</span>
        </button>
      </div>
      {helpText && (
        <p id={helpId} className="mt-1 text-xs text-slate-500">
          {helpText}
        </p>
      )}
    </div>
  );
}
