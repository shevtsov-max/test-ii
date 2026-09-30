/**
 * Требования к паролю и оценка надёжности — общие для формы и локального API
 * (серверный API обязан проверять то же самое).
 */

/** Текст ошибки или пустая строка, если пароль подходит. */
export function validatePassword(pw) {
  if (!pw || pw.length < 8) return 'Не короче 8 символов'
  if (!/[a-zа-яё]/i.test(pw) || !/\d/.test(pw)) return 'Используйте буквы и цифры'
  return ''
}

/**
 * Надёжность 0–4 для индикатора под полем.
 * @returns {{ score: number, label: string }}
 */
export function passwordStrength(pw) {
  if (!pw) return { score: 0, label: '' }
  let score = 0
  if (pw.length >= 8) score++
  if (pw.length >= 12) score++
  if (/[a-zа-яё]/.test(pw) && /[A-ZА-ЯЁ]/.test(pw)) score++
  if (/\d/.test(pw) && /[^\p{L}\d]/u.test(pw)) score++
  if (validatePassword(pw)) score = Math.min(score, 1)
  return { score, label: ['Слишком простой', 'Слабый', 'Средний', 'Хороший', 'Надёжный'][score] }
}
