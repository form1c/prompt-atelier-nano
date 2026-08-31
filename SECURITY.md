# Security Policy

## Supported versions

| Version | Supported |
|---|---|
| 1.0.x | yes |

## Reporting a vulnerability

Please do not report security issues through public issues, pull requests or discussions.

Use GitHub's private reporting instead: on the repository page open **Security**, then **Report a vulnerability**. The report stays private until a fix is available.

Please include:

- the version, taken from the foot of the left column in the running application or from the `VERSION` file of the release
- the browser and its version, and the operating system
- the storage line shown under the header, which states where the collection is kept
- what you observed and how to reproduce it
- the effect you consider possible

## What to expect

This is a project maintained in spare time. There is no guaranteed response time and no service level agreement. Reports are read and answered as time allows.

## Scope

Prompt Atelier Nano is a single HTML file opened from a folder. There is no server, no account and no service operated by the project. Every installation is a copy of that file on somebody's machine.

In scope are defects in the application, in the delivered scripts and in the documented behaviour.

Out of scope are:

- **the absence of encryption.** The collection is stored unencrypted, and this is stated in the manuals. A password would have to be stored in the file or derived from it, and the file is readable by anyone
- **the loss of data when browser storage is cleared.** No programming interface can prevent it, and the application says so without pause
- vulnerabilities in third-party libraries, unless the application uses them in a way that creates the issue. Report those to the library concerned

## Security properties of the application

`doc/installation.md`, chapter 9 lists them. The content security policy of the built file forbids every network connection, so that promise is enforced by the browser rather than by the application. `doc/development.md`, chapter 8 describes how the policy is produced.
