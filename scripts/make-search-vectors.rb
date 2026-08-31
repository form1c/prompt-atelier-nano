# frozen_string_literal: true

# Produces the search vectors, and it is the only Ruby in this repository.
#
# RN-04 is the risk this exists for: a JavaScript search that reproduces
# `Normalization.normalize` and stops there **looks** right and silently loses
# every word carrying an accent. The only defence is a file of expected answers
# that comes from the original rather than from somebody's reading of it.
#
# Run once, by hand, when the normalisation upstream changes:
#
#   cd ../../PromptStorage/project/backend
#   BUNDLE_PATH=vendor/bundle bundle exec ruby \
#     ../../../PromptStorageNano/code/scripts/make-search-vectors.rb
#
# The output is versioned; this script is not part of the build. Node stays the
# toolchain (Quelltextabgleich.md, section 4) — a generator that runs when a
# rule changes is not the same thing as a build dependency.
#
# **Two steps, and the second is the one that gets forgotten.** A term reaches
# the index through both of these, and only both together:
#
#   1. `Normalization.normalize` — the SQL trigger, filling the *_norm columns
#   2. the FTS5 tokenizer `unicode61 remove_diacritics 2` — splitting and
#      stripping what is left
#
# Step 2 is asked of SQLite itself rather than described, because a description
# is a third implementation. What the tokenizer says is what the index holds.

require 'json'
require 'sqlite3'

ATELIER = File.expand_path('../../../PromptStorage/project', __dir__)
require File.join(ATELIER, 'backend/services/normalization')

OUT = File.expand_path('../tests/vectors/search.json', __dir__)

PROBES = [
  # German: the letters the tokenizer cannot help with, and the digraph rule
  'Größe', 'Groesse', 'Grosse', 'grösse',
  'Straße', 'Strasse', 'STRASSE',
  'Übung', 'Uebung', 'Ubung',
  'Ärger', 'Aerger', 'Öl', 'Oel',
  'Fußgängerübergang',

  # The languages the tokenizer does handle, measured over seven in AP-18
  'Café', 'cafe', 'Résumé', 'entretien',
  'Año', 'nuevo', 'niño',
  'Città', 'paesi', 'perché',
  'français', 'garçon', 'élève',
  'coração', 'ação',

  # Letters with a stroke and ligatures: Unicode does not decompose either, so
  # `remove_diacritics` cannot take them off and the table in normalization.rb
  # does it by hand
  'Łódź', 'rød', 'Øre', 'Đakovo',
  'Cœur', 'coeur', 'sœur', 'Bœuf', 'Æther', 'aether',

  # The same text in both encodings. macOS produces the decomposed form when
  # copying, and without the composing step a term pasted from there finds
  # nothing at all — not even a prompt stored in that very form.
  "Übung",           # precomposed Ü
  "Übung",          # U + combining diaeresis
  "Große",
  "Café",           # e + combining acute

  # Separators, and the one that surprises: the underscore splits.
  'a1_b', 'snake_case_name', 'kebab-case', 'dotted.name',
  'CamelCase', 'ABC123', '2026-08-14',
  'Ein Satz, mit Zeichen!', '  viel   Abstand  ',

  # Nothing to find
  '', '   ', '---', '!!!',

  # Whole phrases, the way a prompt title actually reads
  'Blogartikel für Einsteiger',
  'Prüfung der Größe in Straßburg',
  'Zusammenfassung eines Protokolls'
].freeze

db = SQLite3::Database.new(':memory:')
db.execute(%(CREATE VIRTUAL TABLE probe USING fts5(x, tokenize="unicode61 remove_diacritics 2")))

# The tokens SQLite makes of one text. Asked per text and cleaned up after, so
# that the answer is about this text and not about everything asked so far.
#
# **What comes back is a set, not a sequence.** `fts5vocab` is the term
# dictionary of the index: it has no order of its own, and a word occurring
# twice appears once. So these vectors say **which** tokens a text yields, never
# in what order or how often — and the JavaScript side has to be compared the
# same way. For prefix matching that is the whole truth anyway; order and
# repetition never enter into it.
def tokens_of(db, text)
  db.execute('DELETE FROM probe')
  db.execute('INSERT INTO probe(x) VALUES (?)', [text])
  db.execute('SELECT term FROM probe_vocab ORDER BY term').flatten
end

db.execute('CREATE VIRTUAL TABLE probe_vocab USING fts5vocab(probe, row)')

vectors = PROBES.map do |probe|
  normalised = PromptAtelier::Normalization.normalize(probe)

  {
    'input' => probe,
    'normalized' => normalised,
    'tokens' => tokens_of(db, normalised)
  }
end

File.write(OUT, JSON.pretty_generate(
  '_note' => 'Erzeugt von scripts/make-search-vectors.rb aus Prompt Atelier. ' \
             'normalized = Normalization.normalize, tokens = was der FTS5-Tokenizer daraus macht. ' \
             'Die JavaScript-Suche muss beide Schritte zusammen reproduzieren. ' \
             'tokens ist eine MENGE: sortiert und ohne Wiederholung, weil fts5vocab das Woerterbuch ' \
             'des Index ist und weder Reihenfolge noch Haeufigkeit kennt.',
  '_source' => 'backend/services/normalization.rb + fts5 unicode61 remove_diacritics 2',
  '_generated_at' => Time.now.strftime('%Y-%m-%d'),
  'vectors' => vectors
) + "\n")

puts "#{vectors.size} Vektoren nach #{OUT}"
puts "Beispiel: #{vectors.first['input'].inspect} -> #{vectors.first['tokens'].inspect}"
