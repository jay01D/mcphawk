export type RedactRule = {
  name: string;
  pattern: RegExp;
  replace: string;
};

export const defaultRules: RedactRule[] = [
  {
    name: "bearer-token",
    pattern: /Bearer\s+[A-Za-z0-9._\-+/=]{16,}/gi,
    replace: "Bearer ***redacted***",
  },
  {
    name: "openai-key",
    pattern: /\bsk-[A-Za-z0-9]{20,}\b/g,
    replace: "sk-***redacted***",
  },
  {
    name: "anthropic-key",
    pattern: /\bsk-ant-[A-Za-z0-9_\-]{20,}\b/g,
    replace: "sk-ant-***redacted***",
  },
  {
    name: "aws-access-key",
    pattern: /\b(?:AKIA|ASIA)[A-Z0-9]{16}\b/g,
    replace: "***aws-access-key***",
  },
  {
    name: "jwt",
    pattern: /\beyJ[A-Za-z0-9_\-]+\.[A-Za-z0-9_\-]+\.[A-Za-z0-9_\-]+\b/g,
    replace: "***jwt***",
  },
  {
    name: "password-field",
    pattern: /"(password|api[_-]?key|secret|token)"\s*:\s*"[^"]*"/gi,
    replace: '"$1":"***redacted***"',
  },
];

export class Redactor {
  private rules: RedactRule[];

  constructor(rules: RedactRule[] = defaultRules) {
    this.rules = rules;
  }

  apply(raw: string): string {
    let out = raw;
    for (const r of this.rules) out = out.replace(r.pattern, r.replace);
    return out;
  }
}
