**English** · [Deutsch](installation.de.md)

# Prompt Atelier Nano: Deployment

| | |
|---|---|
| Version | 1.0 |
| Date | 2026-08-15 |
| Reader | Anyone handing the application out or placing it on a share |
| Scope | Getting the file onto a machine, the two operating modes, and what a managed workstation can take away. Day to day use is in `manual.md`. The source is in `development.md` |

---

## Contents

1. Preparation
2. Deployment
3. Operating modes
4. What the browser decides
5. Verifying a target machine
6. Backup and restore
7. Updating
8. Troubleshooting
9. Security properties
10. Limits

---

## 1. Preparation

There is nothing to install. Check three points before handing the file out.

| Check | Requirement |
|---|---|
| Browser | A current Chromium, Edge, Firefox or Safari. Tested on Chromium 151, Firefox 153, WebKit 605 and Microsoft Edge 151. No minimum is claimed, because none was measured |
| Opening local files | The person must be able to open an HTML file from a folder. Some managed machines forbid this |
| A folder that is backed up | The application can write a backup file, and that file is only worth something if the folder it sits in is included in a backup |

No administrator rights are needed. Nothing is written outside the browser
profile and the folder the person chooses themselves.

---

## 2. Deployment

1. Copy `prompt-atelier-nano.html` onto the target machine.
2. Ask the person to open it by double click.
3. Ask them to read chapter 1 of the user manual before they start working.

Step 3 is essential. The collection lives in the storage of the browser. Without
that knowledge, data loss is likely.

Pass on the HTML file only. Everything the application needs is inside it.

---

## 3. Operating modes

Two modes are possible, and the second carries a hazard that is easy to miss.

### 3.1 Local file

The intended mode. The file lies on the machine and is opened from the folder it
is in. Each machine has its own collection.

The address then reads `file:///C:/Users/.../prompt-atelier-nano.html`.

### 3.2 File on a network share

The same file can be placed on a share and opened from there. This is convenient
for handing out updates, and it has one consequence that has to be understood
before it is chosen.

> **Warning:** browsers separate stored data by origin, not by file. Under
> Chromium every file opened from the local file system shares one storage area.
> Two people opening the same file from the same share on the same machine and
> under the same user profile therefore work on the same collection. Two people
> on two machines do not, because the browser profile is per machine.
>
> Measured on Chromium 151: a copy in one folder and a copy in another, under one
> profile, share a collection. The second copy opened with the 55 prompts of the
> first and did not ask about the examples again.

The practical rule is:

| Situation | Result |
|---|---|
| One share, several machines, one person per machine | Each person has their own collection. Safe |
| One share, one machine, several user profiles | Each profile has its own collection. Safe |
| One share, one machine, one profile, several people | One shared collection. Whoever writes last wins |

The application detects a second open window and switches the newer one to read
only, so two windows cannot overwrite each other. It cannot detect two people
taking turns at the same profile.

If the share is used only to distribute the file, and each person copies it onto
their own machine before using it, this restriction does not apply.

---

## 4. What the browser decides

The application does not ask the browser what it can do. It tries, and it reports
the result in the storage line under the header. Three outcomes.

| Line reads | Meaning |
|---|---|
| `Stored in: Browser storage` | Normal case. The collection survives closing the browser and restarting the machine |
| `Stored in: Browser storage, limited` | The larger storage was refused. The collection still survives, and the limit is about 500 prompts |
| `Stored in: Nothing is stored` | Storage is switched off on this machine. The application works fully and forgets everything when the window closes |

The third case is a working state and not a fault. It occurs when a policy
disables browser storage. The header states it continuously. An export is
required before the window is closed.

A fourth possibility is offered rather than detected. If the browser supports it,
the storage line carries the offer to also write the collection into a file on
disk on every change. This is the best available protection, and it costs one
confirmation per session. See chapter 6.

---

## 5. Verifying a target machine

Where a machine is managed and its policies are unknown, the assumptions above
can be measured instead of trusted. The repository contains a test file for this
purpose at `probe/workstation-check.html`.

1. Copy the file onto the target machine and open it by double click.
2. Press the four buttons at the bottom.
3. Send back the report. It is at the end of the page and can be copied.

The report states which storage is available, how large it is, whether a real
file can be written and whether an entry survives a restart. Running it a second
time after a restart answers the question that matters most, which is whether
data is kept overnight.

---

## 6. Backup and restore

The collection lives in the storage of the browser. That storage can be cleared
by the person, by a cleanup tool or by a policy at sign-out. No programming
interface can prevent this. Two protections exist, and the first is better.

### 6.1 A file on disk, written automatically

In the storage line, choose **Also save to a file on disk**. Pick a folder that
is backed up. From then on the whole collection is
written into that file on every change, in the exchange format.

The browser asks for confirmation once per session. This is deliberate on the
part of the browser, not a fault of the application. A bar with a button appears,
one click resumes the writing.

The offer is absent where the browser does not support it. Measured: present in
Chromium 151, absent in Firefox 153 and WebKit 605.

### 6.2 Export by hand

Top right the header counts the changes since the last backup. Clicking it leads
to the transfer page, where **Export** produces a JSON file.

Markdown is offered as well. It is meant for reading and for filing in a wiki,
and it is not lossless. Timestamps and keyword definitions are missing from it.
Use JSON for backups.

### 6.3 Restoring

Open the application, go to **Import/Export**, and read the backup file back in.
It is an ordinary export file. The import shows a preview first and is all or
nothing, so a file that turns out to be unusable leaves the collection untouched.

---

## 7. Updating

Replace the HTML file with the newer one. The collection is untouched, because it
lives in the browser and not in the file.

A newer file may write the collection in a newer shape. An older file then
refuses to touch it and says so instead of dropping the fields it does not know.
If the shape changes, the newer file exports a backup once, without asking,
before it writes anything.

Which version is running is shown at the foot of the sidebar.

---

## 8. Troubleshooting

| Symptom | Cause and remedy |
|---|---|
| The page stays blank | The file was damaged in transit. Copy it again. Sending it by email can change line endings, so use a share or an archive |
| The library is empty although prompts were entered | Check the storage line. If it reads `Nothing is stored`, browser storage is switched off on this machine and nothing was kept |
| A bar says the file is already open in another window | Close the second window. The application refuses to write from two windows so that they cannot overwrite each other |
| A bar asks for confirmation on every start | Normal. The browser withdraws permission for the backup file at the end of a session. One click restores it |
| A bar says the storage is full | Export at once. The last change is only in memory. Afterwards, empty the trash and remove what is no longer needed |
| The version at the foot of the sidebar is not visible | Scroll down. The tag list can push it below the visible area |

For a report, two details answer most questions. The version at the foot of the
sidebar, and the storage line under the header.

---

## 9. Security properties

| Property | State |
|---|---|
| Network requests | None. The content security policy of the file forbids them, so this is enforced by the browser rather than promised by the application |
| External resources | None. Icons, fonts, translations and example data are inside the file |
| Encryption | None. Anyone with access to the browser profile or to the backup file can read the prompts |
| Sign-in | None. The application is not a place for credentials or secrets |
| Rendered content | Prompt text is inserted as text, never as markup |

The absence of encryption is a deliberate decision. A password would have to be
stored in the file or derived from it. Since the file is readable by anyone, the
key would be as accessible as the data. The absence of encryption is therefore
stated rather than simulated.

---

## 10. Limits

| Limit | Value |
|---|---|
| Prompts | 500 of usual length, at one revision each |
| Storage in the browser | About 5.2 million characters, measured identically on four browser engines |
| History | One step back per prompt. There is no longer version history |
| Trash | 30 days, then removal at the next start |
| Collections | One. There are no workspaces, and tags are the means of order |
| Sharing | None. Prompts are exchanged as files |

The collection cannot be reached from a second device. The export file is the way
to move it.
