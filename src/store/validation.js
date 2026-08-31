// The limits of chapter 14.3, and what they are for here.
//
// On the server these are SEC-08: a defence. Here there is nobody to defend
// against — whoever uses this build owns the machine it runs on. What they
// still do, and the reason they are copied down to the number, is keep the
// collection **exchangeable**: a prompt with a 250-character title would be
// accepted here and then refused halfway through an import into the main
// application, leaving somebody with half a transfer and no idea which half.
//
// So the rule is: the same limits, the same field names, the same answer shape.
// `Prompts::LIMITS` and `Catalog` are the originals.
//
// The answer shape is copied even where it is odd. A field problem is reported
// as `{ limit, minimum, actual }` **without** a `code`, which is what the server
// sends and what the screens therefore expect. It has a consequence worth
// knowing: `ApiError.fieldMessage` looks for `problem.code`, does not find one,
// and falls back to the general sentence — so a too-long title reads as "an
// unexpected error occurred" beside the field. That is upstream behaviour, and
// it is reproduced rather than improved: a message that differs between the two
// applications is a difference nobody can see until they compare them.

export const LIMITS = {
  title: { min: 1, max: 200 },
  description: { min: 0, max: 1000 },
  body: { min: 1, max: 100_000 },
  model_hint: { min: 0, max: 200 },
  default_value: { min: 0, max: 2000 }
}

export const MAX_VARIABLES = 50
export const MAX_OPTIONS = 100
export const MAX_TAGS = 20
export const MAX_KEYWORDS = 200
export const KEYWORD_NAME = { min: 1, max: 40 }
export const KEYWORD_TEXT = { min: 1, max: 5000 }
export const TAG_NAME = { min: 1, max: 40 }

export const VISIBILITIES = ['private', 'workspace', 'instance']
export const STATUSES = ['draft', 'active', 'archived']
export const VARIABLE_TYPES = ['text', 'multiline', 'select', 'number']
export const POSITIONS = ['prepend', 'append']

// Carries the code and the per-field problems, so that the caller can turn it
// into the answer of 15.2 without knowing the rules.
export class Invalid extends Error {
  constructor (code, fields = {}) {
    super(code)
    this.name = 'Invalid'
    this.code = code
    this.fields = fields
  }
}

// Every offending field at once. Reporting only the first would make somebody
// correct one thing, submit again, and be refused for the next — the reasoning
// the server states for the same decision.
export function checkPrompt (attributes, { required = true } = {}) {
  const fields = {}

  text(fields, attributes, 'title', required)
  text(fields, attributes, 'description', false)
  text(fields, attributes, 'body', required)
  text(fields, attributes, 'model_hint', false)

  enumeration(fields, attributes, 'visibility', VISIBILITIES)
  enumeration(fields, attributes, 'status', STATUSES)

  if (Object.keys(fields).length > 0) throw new Invalid('validation_failed', fields)

  const tags = attributes.tags ?? []
  if (tags.length > MAX_TAGS) {
    throw new Invalid('too_many_tags', { limit: MAX_TAGS, actual: tags.length })
  }

  for (const variable of attributes.variables ?? []) {
    const options = variable.options ?? []
    if (Array.isArray(options) && options.length > MAX_OPTIONS) {
      throw new Invalid('too_many_options', { limit: MAX_OPTIONS, actual: options.length })
    }

    const value = String(variable.default_value ?? '')
    if (value.length > LIMITS.default_value.max) {
      throw new Invalid('validation_failed', {
        default_value: { limit: LIMITS.default_value.max, minimum: 0, actual: value.length }
      })
    }
  }
}

// The count is checked against the keys the **text** yields, not against what
// the editor sent: the set of variables follows from the body and from nothing
// else (FA-301).
export function checkVariableCount (keys) {
  if (keys.length > MAX_VARIABLES) {
    throw new Invalid('too_many_variables', { limit: MAX_VARIABLES, actual: keys.length })
  }
}

export function checkKeyword (attributes, { existing = [], id = null } = {}) {
  const name = String(attributes.name ?? '').trim()
  const text = String(attributes.text ?? '')

  if (name.length < KEYWORD_NAME.min || name.length > KEYWORD_NAME.max) {
    throw new Invalid('name_invalid', {})
  }
  if (text.length < KEYWORD_TEXT.min || text.length > KEYWORD_TEXT.max) {
    throw new Invalid('validation_failed', {
      text: { limit: KEYWORD_TEXT.max, minimum: KEYWORD_TEXT.min, actual: text.length }
    })
  }
  if (attributes.position && !POSITIONS.includes(attributes.position)) {
    throw new Invalid('validation_failed', { position: { allowed: POSITIONS } })
  }

  // FA-401: the name is unique within the collection. Compared without regard
  // to case, because two keywords called `formal` and `Formal` are one keyword
  // that somebody typed twice.
  const clash = existing.find((keyword) =>
    keyword.id !== id && keyword.name.toLowerCase() === name.toLowerCase())
  if (clash) throw new Invalid('name_taken', {})

  if (id === null && existing.length >= MAX_KEYWORDS) {
    throw new Invalid('validation_failed', { name: { limit: MAX_KEYWORDS, actual: existing.length } })
  }

  return { ...attributes, name }
}

export function checkTagName (name) {
  const clean = String(name ?? '').trim()
  if (clean.length < TAG_NAME.min || clean.length > TAG_NAME.max) {
    throw new Invalid('name_invalid', {})
  }
  return clean
}

// --- the pieces -------------------------------------------------------------

function text (fields, attributes, key, required) {
  if (!(key in attributes)) {
    if (required) fields[key] = 'required'
    return
  }

  const value = String(attributes[key] ?? '')
  const { min, max } = LIMITS[key]

  // The limit and the actual length, not just "too long": a message without a
  // number leaves the reader guessing (TF-428).
  if (value.length < min || value.length > max) {
    fields[key] = { limit: max, minimum: min, actual: value.length }
  }
}

function enumeration (fields, attributes, key, allowed) {
  if (!(key in attributes)) return
  if (!allowed.includes(String(attributes[key]))) fields[key] = { allowed }
}
