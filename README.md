# LET IT DIE Standard Tengoku Start-Floor Selector

## Native EXE compatibility (build 25386710)

A different whole-file EXE hash no longer automatically rejects this reviewed
build: the fallback checks the PE layout, all native bytes being overwritten,
and the complete added warp section. Unrelated changes within the existing
layout are preserved on apply/remove. Hook collisions, altered warp code,
changed section layouts, overlays, and missing package hash entries remain
blocked. This is not a no-validation mode or universal mod compatibility.
Package identification and backup-restore safeguards are unchanged.

If automatic installation discovery fails, the interactive launcher asks for
the installation folder or `BrgGame-Steam.exe` path and retries invalid paths.
Terminal CLI commands also prompt when attached to an interactive terminal;
non-interactive commands retain a clear error and can use `--game`.

Use Node.js 22.5 or newer with shared vending management (SQLite migration needs it).

## Shared composition preview — 1.5.1-dev

Update warp, JG, M2G and vending together. Verified vending layers are separated
and recomposed on temporary copies, so warp changes/removal preserve vending
without a reverse installation order. Keep the visible game-folder `LID-Mod-State`.
For old vending installs, register a matching backup using option 8 in the new
vending tool first. Full shared restore refuses later changes; selective removal
preserves other mods. Unknown code/builds and missing baselines are not guessed.
Vending composition targets build 25386710; new paths need gameplay verification.
The v1.4.3 read-only fallback below is for old, unregistered installations only.

[English](README.md) | [한국어](README.ko.md)

Select 51, 101, 201 or 301 before taking the escalator into standard Tengoku from floor 50.

v1.4.3-dev recognizes the reproduced build-25386710 warp + JG on-on + M2G +
full vending combination (Korean/English) for **read-only status**. Reapplying a
verified, already-active selector is a no-op. To change/remove warp, restore
vending first using its option 2, change warp, then reapply vending. Unknown
combinations and mismatched links remain blocked; this is not all-order compatibility.

## Requirements

If startup fails with `executable hash entry count: expected 2, found 0`, send the
**ERROR DIAGNOSTICS** block displayed in the window, or the JSON file shown as
**Error log** from the tool's `logs` folder. It includes the
EXE path, SHA-256, size, PE section layout and package-name encoding counts, not
the executable or your save. Do not bypass the check or assume administrator
access fixes it: the unsupported user's executable still needs investigation.

- Steam offline edition of LET IT DIE on Windows.
- Node.js 18 or newer. No npm install is needed for normal use.
- Support is determined by file/schema checks, not just the displayed game version. Never bypass an unsupported-file error.

## Installation

1. Use **Code → Download ZIP**, then extract the archive.
2. Back up your save separately and close the game completely.
3. Run `run-en.bat` for English, or use `run.bat --lang ko` for Korean. If Windows denies Steam-folder write access, run the launcher as administrator.
4. Read confirmations carefully and keep every backup created by the tool.

English: `node --no-warnings lid-tengoku-warp.js --lang en`.
Korean: `node --no-warnings lid-tengoku-warp.js --lang ko`.
Run these commands in an administrator terminal if Steam-folder access is denied. Without an explicit language, the tool reads the parent folder's `let-it-die-tool-settings.json` preference, then defaults to Korean.

## Important behavior

Changes game packages and executable transition logic. This is standard Tengoku, not NEO. It enters 101/201/301 rather than teleporting directly to 100/200/300. The floor-22 elevator, save and master database are not patch targets.

## Backups and compatibility

Do not delete an older tool folder until its backups have been preserved. Backups are local files, not stored on GitHub. Restoring game files does not undo purchased items, spent currency or subsequent save changes. Compatibility with every other mod or installation order is not guaranteed.

## Translation status

CLI menus, status displays, confirmations and tool-generated runtime errors support English and Korean. File paths, hashes and stored settings are not translated. System errors follow Windows/Node.js language. Applying in English also translates the injected floor selector. To switch its language, rerun apply in the desired language. Known Korean and English maps are recognized and normalize back to the exact original when removed. Translation has been checked on local copies for all four supported map profiles; in-game English layout still requires gameplay confirmation. Historical release notes remain in the [Korean guide](README.ko.md). Translation does not add support for new game builds.

## 1.4.1-dev compatibility fix

English-patched entry maps now select the correct Steam build when the tool is reopened, including builds 25136512, 25244463 and 25386710. An executable with missing package hash entries is still rejected; the error now includes its path, size and SHA-256 for diagnosis. Administrator access cannot resolve that executable-layout error.

All eight M2G combinations for build 25386710 are now recognized and preserved on apply/removal. Use Just Guard tool 1.8.1-dev or newer when changing guard settings on those combined files.

Developer regression coverage includes supported archived executables, Korean and English build selection, and the manual copy-only runner `tests/run-distribution-integration.js`. Game binaries are not distributed with the tests.

Local copy checks passed for four supported builds in both languages: apply, fresh-process status, idempotent reapply, selective removal and exact full-backup restore. On build 25386710, all six installation orders of Warp / Just Guard / M2G produced identical final files and restored the original files through reverse selective removal. Old full backups were correctly blocked after later mod changes. These are file-level checks, not new in-game travel tests. The reported zero-entry executable was not available for reproduction.

For support, include tool version, game build, exact error and relevant logs. Avoid publishing your entire save or unnecessary account identifiers.
