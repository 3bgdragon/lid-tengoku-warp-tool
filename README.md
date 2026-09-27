# LET IT DIE Standard Tengoku Start-Floor Selector

[English](README.md) | [한국어](README.ko.md)

Select 51, 101, 201 or 301 before taking the escalator into standard Tengoku from floor 50.

## Requirements

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

For support, include tool version, game build, exact error and relevant logs. Avoid publishing your entire save or unnecessary account identifiers.
