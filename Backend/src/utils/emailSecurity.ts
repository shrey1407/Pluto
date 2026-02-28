/**
 * Redact sensitive content from email text before sending to AI (e.g. task extraction, suggest reply).
 * Keeps structure so the model can still understand context without exposing OTPs, passwords, etc.
 */
const REDACTED = '[REDACTED]';

/** Common keywords that often precede sensitive values (case-insensitive). */
const SENSITIVE_KEYWORDS =
  /\b(otp|one[- ]?time[- ]?password|verification[- ]?code|auth[- ]?code|security[- ]?code|pin\s*#?|cvv|cvc|password|passwd|pwd|secret[- ]?key|api[- ]?key|access[- ]?token|auth[- ]?token|bearer\s+[a-zA-Z0-9_-]+|confirmation[- ]?code|reset[- ]?code|login[- ]?code|your\s+code|code\s*:)\s*[:\s]*[\dA-Za-z\-_~!@#$%^&*()+={}[\]|\\;:'",.<>?/]+/gi;

/** OTP/code/value after keyword: "OTP is 123456", "code: 987654", "password = xyz" */
const KEYWORD_VALUE = /\b(otp|one[- ]?time[- ]?password|verification[- ]?code|auth[- ]?code|security[- ]?code|pin|cvv|cvc|password|passwd|pwd|secret[- ]?key|api[- ]?key|access[- ]?token|confirmation[- ]?code|reset[- ]?code|login[- ]?code|your\s+code)\s*(is|:|=)\s*[\dA-Za-z\-_~!@#$%^&*()+={}[\]|\\;:'",.<>?/]{2,}/gi;

/**
 * Redact OTPs, passwords, verification codes, and other sensitive fragments from text
 * before feeding to AI. Returns the redacted string.
 */
export function redactSensitiveContent(text: string): string {
  if (!text || typeof text !== 'string') return text;
  let out = text;

  // 1) Redact "keyword is/value : actual_secret" (keeps keyword for context)
  out = out.replace(KEYWORD_VALUE, (match) => match.replace(/\s*(is|:|=)\s*[\dA-Za-z\-_~!@#$%^&*()+={}[\]|\\;:'",.<>?/]{2,}$/i, ` $1 ${REDACTED}`));

  // 2) Redact remaining sensitive keyword + value patterns
  out = out.replace(SENSITIVE_KEYWORDS, (match) => {
    const keywordEnd = match.search(/\s*[:\s][\dA-Za-z]/i);
    if (keywordEnd === -1) return REDACTED;
    return match.slice(0, Math.min(match.length, keywordEnd + 2)) + ' ' + REDACTED;
  });

  return out;
}
