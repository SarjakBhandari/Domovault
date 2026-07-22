'use client';

type Rule = {
  label: string;
  test: (p: string) => boolean;
};

const RULES: Rule[] = [
  { label: 'At least 12 characters',       test: (p) => p.length >= 12 },
  { label: 'Uppercase letter (A-Z)',        test: (p) => /[A-Z]/.test(p) },
  { label: 'Lowercase letter (a-z)',        test: (p) => /[a-z]/.test(p) },
  { label: 'Number (0-9)',                  test: (p) => /[0-9]/.test(p) },
  { label: 'Special character (!@#$ ...)', test: (p) => /[^A-Za-z0-9]/.test(p) },
];

const CONFIGS = [
  { label: '',            barColor: '#e2e8f0', textColor: '' },
  { label: 'Very weak',  barColor: '#ef4444', textColor: '#b91c1c' },
  { label: 'Weak',       barColor: '#f97316', textColor: '#c2410c' },
  { label: 'Fair',       barColor: '#eab308', textColor: '#92400e' },
  { label: 'Good',       barColor: '#84cc16', textColor: '#3f6212' },
  { label: 'Strong',     barColor: '#22c55e', textColor: '#166534' },
];

export function getPasswordScore(password: string): number {
  return RULES.filter((r) => r.test(password)).length;
}

export default function PasswordStrength({ password }: { password: string }) {
  if (!password) return null;

  const score = getPasswordScore(password);
  const cfg = CONFIGS[score];

  return (
    <div style={{ marginTop: '10px' }}>
      {/* 5-segment bar */}
      <div style={{ display: 'flex', gap: '4px', marginBottom: '6px' }}>
        {RULES.map((_, i) => (
          <div
            key={i}
            style={{
              flex: 1,
              height: '4px',
              borderRadius: '999px',
              background: i < score ? cfg.barColor : '#e2e8f0',
              transition: 'background 250ms ease',
            }}
          />
        ))}
      </div>

      {/* Strength label */}
      {cfg.label && (
        <p style={{ fontSize: '0.75rem', fontWeight: 600, color: cfg.textColor, marginBottom: '8px' }}>
          {cfg.label}
        </p>
      )}

      {/* Requirements checklist */}
      <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: '4px' }}>
        {RULES.map((rule) => {
          const passed = rule.test(password);
          return (
            <li
              key={rule.label}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '7px',
                fontSize: '0.75rem',
                color: passed ? '#16a34a' : '#94a3b8',
                transition: 'color 200ms ease',
              }}
            >
              {passed ? (
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" aria-hidden="true">
                  <polyline points="20 6 9 17 4 12" />
                </svg>
              ) : (
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
                  <circle cx="12" cy="12" r="9" />
                </svg>
              )}
              {rule.label}
            </li>
          );
        })}
      </ul>
    </div>
  );
}
