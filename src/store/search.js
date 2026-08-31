// The search (FA-501), and the one place in this project where being almost
// right is worse than being obviously wrong.
//
// The failure this module is built against is `RN-04`: a search that finds
// **less** than it should reports nothing. The user concludes the prompt is not
// there and writes it again. Nothing goes red, nothing is logged, and the
// collection quietly grows duplicates.
//
// ## Why the obvious port is wrong
//
// The main application normalises a text **twice** before it is in the index,
// and only the first half lives in `normalization.rb`:
//
//   1. `Normalization.normalize` — a SQL trigger, filling the `*_norm` columns.
//      `ä→a`, `ö→o`, `ü→u`, `ß→ss`, `ø→o`, `ł→l`, `đ→d`, `æ→ae`, `œ→oe`, then
//      the German digraphs `ae→a`, `oe→o`, `ue→u`.
//   2. the FTS5 tokenizer `unicode61 remove_diacritics 2` — it splits on
//      everything that is not a letter or a digit, lowercases, and strips the
//      combining marks that are left: `é→e`, `à→a`, `ç→c`.
//
// `Normalization.normalize` does **not** touch accents. Its own comment says
// why: the tokenizer does it, on both the stored text and the query, so a rule
// there would be redundant. Port only that function and `Café` is indexed as
// `café` while a search for `cafe` asks for `cafe`. The two never meet, and
// every French, Spanish, Italian and Portuguese prompt becomes unfindable.
//
// So both steps, in this order, are what a term goes through here.
//
// ## How that is held to
//
// `tests/vectors/search.json` holds 60 probes with the answer the original
// gives — produced by `scripts/make-search-vectors.rb`, which runs the real
// `Normalization.normalize` and then asks **SQLite itself** what its tokenizer
// makes of the result. Not a description of the tokenizer; the tokenizer.

// The single letters, in the order `normalization.rb` applies them: uppercase
// first (SQL's `lower()` only folds ASCII, so those entries do the work there
// and are no-ops here), then lowercase, then the ones Unicode will not
// decompose because the stroke or the ligature is part of the letter.
const LETTERS = [
  ['Ä', 'a'], ['Ö', 'o'], ['Ü', 'u'], ['ẞ', 'ss'],
  ['ä', 'a'], ['ö', 'o'], ['ü', 'u'], ['ß', 'ss'],
  ['Ø', 'o'], ['Ł', 'l'], ['Đ', 'd'], ['Æ', 'ae'], ['Œ', 'oe'],
  ['ø', 'o'], ['ł', 'l'], ['đ', 'd'], ['æ', 'ae'], ['œ', 'oe']
]

// The German digraph rule, and the reason it is a group of its own: it is
// **German**, and it damages the other languages. `nuevo` and `nuvo` collapse.
// FA-501 has weighed that and accepted it, because the same rule runs over the
// stored text and over the query, so both sides meet at the same word.
//
// Order matters. All single letters run first, so that `ö → o` cannot turn an
// `öe` into an `oe` that this group folds a second time.
const DIGRAPHS = [['ae', 'a'], ['oe', 'o'], ['ue', 'u']]

// What the tokenizer treats as part of a word: letters and digits, nothing
// else. The underscore is **not** among them — `snake_case_name` is three
// tokens, which is measured rather than assumed (search.json).
const SEPARATOR = /[^\p{L}\p{N}]+/u

// Step 1: the SQL side. Composed first, because an umlaut can arrive as one
// character or as a letter plus a combining mark, macOS produces the second
// when copying, and the replacements below only match the first. Without this
// a term pasted from there finds nothing at all — not even a prompt stored in
// that very form.
export function normalize (text) {
  if (text === null || text === undefined) return ''

  let value = String(text).normalize('NFC').toLowerCase()
  for (const [from, to] of LETTERS) value = value.split(from).join(to)
  for (const [from, to] of DIGRAPHS) value = value.split(from).join(to)

  return value
}

// Step 2: what the tokenizer does. Decompose, drop the combining marks, split.
export function tokens (text) {
  return normalize(text)
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .split(SEPARATOR)
    .filter(Boolean)
}

// --- the index --------------------------------------------------------------

// bm25 weights, one per field, taken from `Search::WEIGHTS`. Tags sit between
// description and body: somebody who tags a prompt "seo" means it more
// deliberately than somebody who mentions seo somewhere in a long text.
export const WEIGHTS = { title: 10, description: 5, tags: 3, body: 1 }

export function indexOf (prompt) {
  return {
    title: tokens(prompt.title),
    description: tokens(prompt.description),
    tags: tokens((prompt.tags ?? []).join(' ')),
    body: tokens(prompt.body)
  }
}

// The words of a search term. `null` when there is none — which means "no text
// filter", not "no results": a search box holding only spaces must not empty
// the library.
export const termsOf = (term) => {
  const words = tokens(term)
  return words.length === 0 ? null : words
}

// Every word of the term must match, each as a **prefix**. Several words are
// AND-connected, which is what FA-501 asks for and what FTS5 does with several
// quoted prefix tokens.
function scoreOf (index, words) {
  let total = 0

  for (const word of words) {
    let found = 0

    for (const [field, weight] of Object.entries(WEIGHTS)) {
      const hits = index[field].filter((token) => token.startsWith(word)).length
      if (hits === 0) continue

      // Divided by the square root of the field length so that a long body
      // does not win on volume alone. Not bm25 — that needs the statistics of
      // the whole collection and an inverted index to go with them. The
      // **set** of hits is identical to the server's; the order is similar.
      // Which of the two is exchanged between the applications? Neither. So
      // the set is what must match, and it does.
      found += (weight * hits) / Math.sqrt(index[field].length || 1)
    }

    // One word without a single hit anywhere means this row is out.
    if (found === 0) return null
    total += found
  }

  return total
}

// Rows that match, best first, each with the score it got.
export function find (rows, term, indexFor) {
  const words = termsOf(term)
  if (words === null) return rows.map((row) => ({ row, score: 0 }))

  const found = []
  for (const row of rows) {
    const score = scoreOf(indexFor(row), words)
    if (score !== null) found.push({ row, score })
  }

  return found.sort((one, other) => other.score - one.score)
}

// --- highlighting -----------------------------------------------------------

// Ranges `[start, length]` in the **original** text that a term matches.
//
// Whole words, not the matched prefix, and the reason is the same one the
// server gives: a position in the normalised text cannot be mapped back to the
// original, because `ß` becomes two characters and `ue` becomes one. Any
// character-exact answer would need an index map that both sides would have to
// reproduce identically. Marking the whole word avoids that and reads better
// anyway — for "blog" the eye wants "Blogartikel" marked, not its first four
// letters.
export function highlightRanges (text, term) {
  const words = termsOf(term)
  const source = String(text ?? '')
  if (words === null || source === '') return []

  const ranges = []
  for (const match of source.matchAll(/[\p{L}\p{N}]+/gu)) {
    const [normalised] = tokens(match[0])
    if (!normalised) continue
    if (!words.some((word) => normalised.startsWith(word))) continue

    ranges.push([match.index, match[0].length])
  }

  return ranges
}
