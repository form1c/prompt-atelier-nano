// The clear-out (FA-703, FA-706) — the only place in this build where content
// disappears without anybody having pressed anything.
//
// On the server this is a daily job with a log entry per run, and the log entry
// is half the requirement: "ein Lauf, der nichts meldet, ist von einem, der
// nicht stattgefunden hat, nicht zu unterscheiden" (retention.rb). There is no
// job here and no log, so the run happens at start-up and **reports to the
// screen** instead. Same requirement, the only mechanism this build has.
//
// Three rules, and the middle one is the one that took thinking:
//
//   1. Older than thirty days in the bin, then gone. That is FA-703 and the
//      `trash.intro` sentence already on the screen promises exactly it.
//   2. **Only what can be read is deleted.** A `deleted_at` that will not parse,
//      or that lies in the future because a clock was wrong, is not evidence of
//      age — and deleting on the strength of a value nobody can read is how a
//      sweep becomes the fault it was meant to prevent. Such a prompt stays in
//      the bin for ever, which is the harmless direction of being wrong.
//   3. The revisions go with them. Here that is one field on the object rather
//      than a second table, so it happens by itself — but it is written down
//      because `trash.purge_hint` promises it out loud.

export const TRASH_DAYS = 30

const DAY = 24 * 60 * 60 * 1000

// How long a binned prompt still has, in whole days, or null when the question
// cannot be answered — an unreadable stamp, or one from the future.
//
// Rounded **up**: something with eleven and a half days left has "12 Tage", and
// the last day reads "1 Tag" rather than "0 Tage" until it is really gone.
export function daysLeft (deletedAt, now = new Date()) {
  const age = ageOf(deletedAt, now)
  if (age === null) return null

  return Math.max(Math.ceil(TRASH_DAYS - (age / DAY)), 0)
}

function ageOf (deletedAt, now) {
  if (!deletedAt) return null

  const stamp = new Date(deletedAt).getTime()
  if (Number.isNaN(stamp)) return null

  const age = now.getTime() - stamp
  // A negative age means the stamp is in the future: a clock that was wrong
  // when the prompt was deleted, or one that is wrong now. Either way the age
  // is unknown, not zero.
  return age < 0 ? null : age
}

export const overdue = (prompt, now = new Date()) => {
  const age = ageOf(prompt.deleted_at, now)

  return age !== null && age > TRASH_DAYS * DAY
}

// Removes what is due and answers what it removed, by name. The caller writes
// the record back and puts the sentence on the screen; nothing here saves or
// speaks, so that the same function can be asked what it *would* do.
//
// Mutates the record rather than returning a copy, because the caller holds the
// live one and a copy would have to be assigned back — an assignment that is
// easy to forget and impossible to see when it is missing.
export function sweep (record, now = new Date()) {
  const doomed = record.prompts.filter((prompt) => overdue(prompt, now))
  if (doomed.length === 0) return { removed: [] }

  const gone = new Set(doomed.map((prompt) => prompt.id))

  record.prompts = record.prompts.filter((prompt) => !gone.has(prompt.id))
  record.favorites = (record.favorites ?? []).filter((id) => !gone.has(id))

  return { removed: doomed.map((prompt) => ({ id: prompt.id, title: prompt.title })) }
}
