// Between the file format and the collection (Requirements 17.1 against 14.1).
//
// An export package and a stored prompt are not the same shape, and the three
// places where they differ each cost a bug in AP-N2 — every one of them visible
// as something odd on the screen rather than as an error:
//
//   | in a file (17.1)          | in the collection (14.1)      |
//   |---------------------------|-------------------------------|
//   | `tags: ["seo", "blog"]`   | the same names, plus their ids|
//   | `options: ["a", "b"]`     | one text, one option per line |
//   | `default_keywords: [name]`| the keyword rows in full      |
//
// On the server this is `Transfer.exported_variables` and `Transfer.option_list`.
// Here both directions live side by side so that they can be read as each
// other's inverse, because AP-N6 has to send back what it took in (FA-804).

// A select variable's options: a list in a file, one text in a row. The empty
// cases are kept apart deliberately — `null` means "this variable has no
// options", `[]` would mean "it has a list and the list is empty", and a
// select box with no options is a different mistake from a text field.
export const optionText = (options) =>
  (Array.isArray(options) ? options.join('\n') : options ?? null)

export const optionList = (text) => {
  const value = String(text ?? '').trim()
  if (value === '') return null

  return value.split('\n').map((option) => option.trim()).filter(Boolean)
}

// --- a package becomes a collection -----------------------------------------

// The tag catalogue of a set of prompts: one entry per distinct name, sorted,
// with the number of prompts carrying it.
//
// **The identifiers are assigned here and nowhere else.** Assigning them per
// prompt was the AP-N2 bug that made every prompt's first tag id 1, so
// filtering by a tag found nothing at all. One catalogue, one numbering.
export function tagsFrom (prompts, collation = 'de') {
  const names = [...new Set(prompts.flatMap((prompt) => prompt.tags ?? []))]
    .sort((a, b) => a.localeCompare(b, collation))

  return names.map((name, index) => ({
    id: index + 1,
    name,
    usage_count: prompts.filter((prompt) => (prompt.tags ?? []).includes(name)).length
  }))
}

export function keywordsFrom (entries) {
  return (entries ?? []).map((keyword, index) => ({
    id: index + 1,
    name: keyword.name,
    description: keyword.description ?? null,
    text: keyword.text ?? '',
    position: keyword.position ?? 'append',
    sort_order: keyword.sort_order ?? 100
  }))
}

// One prompt of a package, as the screens expect to receive it.
//
// `workspace_name` stays absent on purpose: PromptList only draws the origin of
// a hit when that field is set, and the name of the one collection on every row
// of a list that holds nothing else says nothing (EN-03).
export function promptFrom (entry, { id, workspaceId, tags, keywords }) {
  const names = entry.tags ?? []
  const chosen = entry.default_keywords ?? []

  return {
    id,
    workspace_id: workspaceId,
    title: entry.title,
    description: entry.description ?? null,
    body: entry.body ?? '',
    visibility: entry.visibility ?? 'private',
    status: entry.status ?? 'active',
    model_hint: entry.model_hint ?? null,

    tags: names,
    tag_ids: names.map((name) => tags.find((tag) => tag.name === name)?.id).filter(Boolean),

    variables: (entry.variables ?? []).map((variable) => ({
      key: variable.key,
      label: variable.label ?? null,
      type: variable.type ?? 'text',
      default_value: variable.default_value ?? null,
      options: optionText(variable.options),
      required: variable.required === true,
      position: variable.position ?? 0
    })),
    variable_count: (entry.variables ?? []).length,

    // The prompt's own keywords in full, not by name: the preview renders in
    // the browser (NFA-14) and needs text, position and order.
    //
    // **By `sort_order`, then by name**, which is what `Prompts.default_keywords`
    // orders by — and not the order they happen to stand in the file or in the
    // catalogue. Two reasons, and the second is the one that bites: the
    // rendering pipeline sorts by the same two keys anyway (chapter 8, step 3),
    // so any other order here is meaningless; and an order that depends on when
    // a keyword was created makes an export→import→export round trip come out
    // different from what went in.
    keywords: keywords
      .filter((keyword) => chosen.includes(keyword.name))
      .sort((one, other) =>
        (Number(one.sort_order) || 0) - (Number(other.sort_order) || 0) ||
        String(one.name).localeCompare(String(other.name), 'de')),

    created_at: entry.created_at ?? null,
    updated_at: entry.updated_at ?? null,
    deleted_at: null,
    revision_count: 0,
    favorite: false
  }
}

// A whole package. Returns the three lists a collection is made of.
export function collectionFrom (data, { workspaceId = 1, firstId = 1 } = {}) {
  const entries = data.prompts ?? []
  const tags = tagsFrom(entries)
  const keywords = keywordsFrom(data.keywords)

  const prompts = entries.map((entry, index) =>
    promptFrom(entry, { id: firstId + index, workspaceId, tags, keywords }))

  return { prompts, tags, keywords }
}

// --- a collection becomes a package -----------------------------------------

// The other direction, and the one FA-804 is about. Written now rather than in
// AP-N6 so that the two stay next to each other: a change to one that forgets
// the other is the way a round trip starts losing fields.
export function packageFrom (record, { now = new Date() } = {}) {
  const alive = record.prompts.filter((prompt) => !prompt.deleted_at)

  return {
    format: 'promptatelier-export',
    version: 2,
    exported_at: now.toISOString(),
    workspace: { name: record.collection.name },
    keywords: record.keywords.map((keyword) => ({
      name: keyword.name,
      description: keyword.description,
      text: keyword.text,
      position: keyword.position,
      sort_order: keyword.sort_order
    })),
    prompts: [...alive]
      .sort((a, b) => String(a.title).localeCompare(String(b.title), 'de'))
      .map((prompt) => ({
        title: prompt.title,
        description: prompt.description,
        body: prompt.body,
        visibility: prompt.visibility,
        status: prompt.status,
        model_hint: prompt.model_hint,
        tags: prompt.tags,
        default_keywords: prompt.keywords.map((keyword) => keyword.name),
        variables: prompt.variables.map((variable) => ({
          key: variable.key,
          label: variable.label,
          type: variable.type,
          default_value: variable.default_value,
          options: optionList(variable.options),
          required: variable.required === true,
          position: variable.position
        })),
        created_at: prompt.created_at,
        updated_at: prompt.updated_at
      }))
  }
}
