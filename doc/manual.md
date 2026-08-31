**English** · [Deutsch](manual.de.md)

# Prompt Atelier Nano: User Manual

| | |
|---|---|
| Version | 1.0 |
| Date | 2026-08-15 |
| Reader | Anyone using the application |
| Scope | Daily work, from the durability of the data to the exchange of prompts. Handing the file to further machines is in `installation.md` |

One file, one double click, no installation. No Ruby, no server, no network
connection.

The interface follows the language of your browser. The labels quoted in this
manual are the English ones.

---

## Contents

1. Where your prompts live
2. The first start
3. How a prompt is built
4. Using a prompt
5. Keeping order
6. Taking changes back
7. Exchanging prompts
8. Two limitations
9. Reporting a problem
10. Keyboard
11. What this version cannot do

---

## 1. Where your prompts live

Please read this chapter before first use. The remaining chapters can be looked
up as needed.

Your prompts live in the storage of your browser, not in the HTML file. The file
holds the program, the collection is kept separately from it. Two statements
follow.

The collection survives closing the browser and restarting the machine.

It does not survive clearing the browser data. The same goes for a policy of your
IT department that cleans up at sign-out, and for a new user profile. No program
can prevent this, including this one.

> **Important:** the browser storage is your workplace. It is not your archive.

### 1.1 Two ways to keep a backup

There are two ways. The first is better. It costs one click at the outset and one
per session afterwards.

**Choose a file.** Under the header there is a line beginning with `Stored in:`.
Beside it stands the offer **Also save to a file on disk**. Click it and pick a
place you will find again, preferably one that is included in a backup. From
then on the application writes your whole collection there on every change,
without you doing anything.

Your browser asks for confirmation once per session. It grants permission to
write a file for a limited time on purpose, so that the permission does not
persist unnoticed. The request appears as a bar with a button. After one click
writing continues.

If your browser does not offer this, the offer does not appear at all. Then the
second way remains.

**Export by hand.** Top right there is a number such as `12 unsaved`. It counts
what has happened since the last backup. Click it, then **Export**, and put the
file somewhere it will not be lost. The number then returns to zero.

Once you have chosen a file, this number is dropped. A current backup then
exists at all times, so the number would no longer state anything true.

### 1.2 Restoring

Open the HTML file, go to **Import/Export** and read your backup file back in.
It is an ordinary export file.

---

## 2. The first start

The very first time you open it, you are asked once whether to begin with 55
examples or with an empty collection. Either can be changed later. Examples can
be deleted, and your own prompts can be added at any time. The question is asked only this once.

If you are unsure, choose the examples. They show how a prompt with placeholders
is built, using finished cases. Examples that are not needed can be selected and
deleted together.

---

## 3. How a prompt is built

A prompt is a text you use again and again, with placeholders you fill in when
you use it.

```text
Write a {{kind}} about {{topic}} for {{audience}}.
The tone should be {{tone}}.
```

The double curly braces mark the placeholders. The text decides which
placeholders exist. You do not create them separately. Write `{{topic}}` into the
text and the placeholder is there. Remove it and it is gone.

For each placeholder you can set:

| Setting | Effect |
|---|---|
| Label | What appears beside the field when the name is too terse |
| Kind | Single line, multiple lines, or a choice from a list |
| Default | What is filled in already if you change nothing |
| Required | Without this value nothing is copied |

Where a curly brace is needed as a character rather than as a placeholder, write
`\{{`. The brace then appears unchanged in the text.

---

## 4. Using a prompt

1. **Search.** The field is at the top. The beginning of a word is enough, and
   accents do not matter. `grosse`, `große` and `Größe` all find the same thing.
2. **Open.** The form for the placeholders is on the right.
3. **Fill in.** The preview below changes as you type. What stands there is
   character for character what you will get.
4. **Copy.** One button puts the finished text on the clipboard. From there,
   paste it into the tool you work with.

The following chapters describe how a growing collection is kept in order and
exchanged.

---

## 5. Keeping order

**Tags** are the only means of order. There are no folders. A prompt can carry
several tags, and the library can filter by them. Two tags at once act as **and**,
not as or. The list then shows only prompts carrying both tags.

**Keywords** are blocks of text you write once and attach to many prompts. A
keyword puts its text before or after the prompt. Change the keyword and every
prompt using it changes with it. This suits instructions such as **answer in
German** or a fixed output format.

The **star** marks a prompt as a favourite. In the library, **Favourites only**
hides everything else.

Under **Sort** the list can be ordered by relevance, by **Last changed** or by
**Title A–Z**.

**Draft**, **Active** and **Archived** are the possible states of a prompt.
Archived ones appear in the library only when you choose **Archived only**. The
state takes a prompt out of the working view without deleting it.

---

## 6. Taking changes back

**Undo the last change.** The command is in the menu of a prompt. It goes back
exactly one step, to the state before the last change. There is no longer
history.

**Trash.** Deleted prompts stay there for 30 days and can be restored with one
click. Each line states the remaining time, such as `12 days left`. After that
they are removed for good at the next start of the application, and the
application tells you what it removed.

> **Important: Delete for good** in the trash is the only action in this
> application that cannot be undone. It therefore always asks first.

---

## 7. Exchanging prompts

The exchange runs through **Import/Export** in the left column. It works in both
directions with the full version of Prompt Atelier.

**Handing out.** **Export** gives you a JSON file, either the whole collection or
a selection. This file is lossless. Everything you see is in it.

**Markdown** is available as well, one file per prompt. That format suits reading
and filing in a wiki. Markdown is not lossless, because timestamps and keyword definitions
are missing from it. Use JSON for backups.

**Reading in.** Choose a file. A preview appears before every import. It states
how many prompts are new, where names collide and which keywords would be
created. Only then is anything written.

Where names collide you decide per prompt:

| Decision | Effect |
|---|---|
| Skip | Yours stays as it is. This is the default |
| As a copy | Both are kept, the new one is called **… (Kopie)**. The suffix is German in every interface language, in this application and in the full one |
| Overwrite | Yours is replaced |

An import is carried out completely or not at all. If the file turns out to be
unusable halfway through, your collection stays unchanged.

---

## 8. Two limitations

**Do not open the file twice at the same time.** Two windows on the same
collection would overwrite each other. The application detects this case and
switches the second window to read only. A bar states it. Close the second
window.

> **Important:** your prompts are not encrypted. Anyone with access to your
> browser profile or to your backup file can read them. This application is not
> meant for credentials or secrets.

---

## 9. Reporting a problem

Two details help more than any description.

**The version.** It stands at the very bottom of the left column, below the menu
entries, and reads something like `Version 1.0.0`. Hovering over it also shows
when it was built and which state of Prompt Atelier it is based on.

**The storage.** The line under the header beginning with `Stored in:`. It says
where your prompts actually live.

---

## 10. Keyboard

| Key | Effect |
|---|---|
| `n` | New prompt, from anywhere in the application |
| `Esc` | Closes a dialogue |

The `n` key has no effect while the cursor is in an input field.

---

## 11. What this version cannot do

The following points are not faults. They follow from there being no server
involved.

- No sign-in, no users, no sharing. These are your prompts on your machine.
- No second collection. Tags are the order.
- No version history with comparison. One step back, no more.
- No access from a second device. The export file is there for that.
- No automatic backup to a cloud.

Where one of these is needed, the full version of Prompt Atelier is the suitable
one. The collection can be moved there with an export file.
