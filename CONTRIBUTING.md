# Contributing

Thank you for considering a contribution.

## Before you start

For anything beyond a small fix, open an issue first and describe what you intend to change. That avoids work that cannot be merged.

## Setting up

**This repository cannot be built on its own.** Prompt Atelier Nano is derived from [Prompt Atelier](https://github.com/form1c/prompt-atelier): 49 of its source files are copied from there and are not kept here. Without a checkout of Prompt Atelier beside this one, the build stops with exit code 1 and produces no file.

`doc/development.md` describes the development environment, the directory layout and the design decisions. Section 2 covers the checkout and the one path that has to be set after cloning.

## Running the tests

```bash
npm run check     # everything: sync, import audit, node tests, browser bench, acceptance
```

That single command answers whether the working tree is sound. The parts can also be run separately, see `doc/development.md`, chapter 9.

The browser bench and the acceptance run borrow Playwright from the Prompt Atelier checkout. **Where it is missing, they skip themselves and state why.** A skipped run is not a failure, but it also proves nothing, so a change has to be verified with them present.

All tests have to pass before a change is proposed.

## Expectations for a change

**Every change comes with a test.** A fix comes with a case that fails without it. A new behaviour comes with a case that describes it.

**Verify a new test by mutation.** Damage the code the test covers and check that the test fails. A test that stays green over damaged code does not test what it claims to.

**Test against the shipped build.** Everything that matters here is a property of one file opened over `file://`. The browser bench is built the same way for that reason. A test against a development server proves something about a build nobody ships.

**The source is written in English.** Identifiers, comments and test names. Interface text belongs in the language files, never in a component.

**Copied files are not edited.** Everything under `vendor/` comes from Prompt Atelier and is written read-only. A file that Nano needs differently is shadowed under the same path in `src/`, and the sync reports when the original of a shadowed file changes. `doc/development.md`, chapter 4 describes the mechanism.

**The rendering pipeline is shared with Prompt Atelier**, and both have to produce identical output. They are checked against the same 34 vectors. A divergence between them blocks a change.

## Licence of contributions

Contributions are accepted under the MIT licence of this project. By opening a pull request you agree that your contribution may be published under those terms.
