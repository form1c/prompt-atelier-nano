// Shadows vendor/i18n/index.js — and shadows almost nothing of it.
//
// The problem this solves: Nano has sentences the main application has no
// counterpart for. „Der Browserspeicher ist fast voll" is about a storage tier
// that does not exist over there, and the five language files are copies that
// must not be edited (RN-09).
//
// Three ways out, and two of them are bad:
//
//   * write the sentences into the components — breaks NFA-15, no text belongs
//     in the code, and it puts German into a file whose comments are English
//   * copy the whole 190-line module and add a table — the drift of RN-10 for
//     a handful of strings
//   * **this**: keep the upstream module, wrap the one function that looks a
//     text up, and answer from a small table of Nano's own before asking it
//
// The upstream file is reached by its path rather than through `@/i18n`,
// because that alias resolves to this file and would be a loop.
//
// The two tables cannot collide: everything here lives under `storage.` or
// `nano.`, and upstream uses neither. Asking here first is therefore not a
// precedence rule but the avoidance of an exception — the upstream `t` raises
// for an unknown key outside the production build, and that raise is worth
// keeping for the keys it really owns.
//
// **The two prefixes are the whole rule, and it is not decoration.** AP-N7
// wanted a sentence for the trash and nearly wrote it as `trash.expiry`, next
// to the thirty upstream `trash.*` keys where it reads naturally. It would have
// worked, and the day upstream adds a key of that name this table would have
// swallowed it without a word. So the shadowed screens use `nano.trash.…`,
// which looks slightly wrong on the screen file and is right in the one place
// that matters.

import { t as upstream, currentLanguage } from '../../vendor/i18n/index.js'
import own from '@/i18n/texts.json'

export * from '../../vendor/i18n/index.js'

const lookup = (source, key) => String(key).split('.').reduce(
  (node, part) => (node && typeof node === 'object' ? node[part] : undefined),
  source
)

// The same `{name}` form the upstream file uses, so a sentence reads the same
// in both tables and nobody has to remember which one they are writing for.
const interpolate = (text, replacements) => text.replace(
  /\{(\w+)\}/g,
  (whole, name) => (name in replacements ? String(replacements[name]) : whole)
)

export function t (key, replacements = {}) {
  const language = currentLanguage()
  const value = lookup(own[language] ?? {}, key) ?? lookup(own.en, key)

  if (typeof value === 'string') return interpolate(value, replacements)

  return upstream(key, replacements)
}
