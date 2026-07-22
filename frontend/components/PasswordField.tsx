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
  hideLabel?: boolean;
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
  hideLabel = false,
}: PasswordFieldProps) {
  const [visible, setVisible] = useState(false);
  const [focused, setFocused] = useState(false);
  const inputId = useId();
  const helpId = useId();

  return (
    <div>
      <label htmlFor={inputId} className={hideLabel ? 'sr-only' : 'label'}>
        {label}
      </label>
      <div
        style={{
          display: 'flex',
          borderRadius: '10px',
          border: focused ? '1.5px solid #14b8a6' : '1.5px solid #dde2ea',
          background: '#ffffff',
          boxShadow: focused
            ? 'inset 0 1px 2px 0 rgb(0 0 0 / 0.03), 0 0 0 3.5px rgb(20 184 166 / 0.14)'
            : 'inset 0 1px 2px 0 rgb(0 0 0 / 0.04)',
          transition: 'border-color 150ms ease, box-shadow 150ms ease',
        }}
      >
        <input
          id={inputId}
          name={name}
          type={visible ? 'text' : 'password'}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          autoComplete={autoComplete}
          required={required}
          minLength={minLength}
          aria-describedby={helpText ? helpId : undefined}
          style={{
            flex: 1,
            border: 'none',
            background: 'transparent',
            padding: '10px 14px',
            fontSize: '0.875rem',
            lineHeight: '1.4',
            color: '#0f172a',
            outline: 'none',
            minWidth: 0,
          }}
        />
        <button
          type="button"
          onClick={() => setVisible((v) => !v)}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          aria-pressed={visible}
          style={{
            padding: '0 14px',
            fontSize: '0.75rem',
            fontWeight: 600,
            color: focused ? '#0f766e' : '#94a3b8',
            background: 'none',
            border: 'none',
            cursor: 'pointer',
            flexShrink: 0,
            transition: 'color 150ms ease',
          }}
        >
          {visible ? 'Hide' : 'Show'}
          <span className="sr-only"> password</span>
        </button>
      </div>
      {helpText && (
        <p id={helpId} className="mt-1.5 text-xs text-slate-500">
          {helpText}
        </p>
      )}
    </div>
  );
}
