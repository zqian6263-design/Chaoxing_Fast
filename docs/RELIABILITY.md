# Reliability and portability contract

## Scope
This project automates **normal browser playback and task inventory** for accounts the operator is authorized to use. It does not promise that every class accepts 2x speed or a 91% threshold. Platform settings, grading policy, access limits and additional requirements are authoritative.

The direct-progress-reporting interface mode is experimental and NOT included in the cross-machine acceptance criteria. Do not rely on it to claim coursework completion.

## Completion
The player local timestamp is only a *candidate* for task completion. The program checks the course card for the matching task and a boolean `isPassed === true` on a fresh response. If this cannot be confirmed, it reports `unverified`, not `done`. The Dashboard counts server-confirmed tasks only. Rechecking course records in the official UI is recommended.

## Deployment
Windows: extract the **online bootstrap ZIP** and double-click `install-windows.bat`; it installs dependencies and the Playwright Chromium browser. If no compatible system Node.js exists, the installer fetches a portable official LTS Node.js archive and verifies its published SHA-256 checksum. Double-click `launch-windows.bat` to start interactively. Internet connection is necessary for first install.

macOS/Linux: install Node.js 20+ and run `node setup.mjs` followed by `node start.mjs`. The official Playwright Chromium is downloaded per platform.

The files `cookies.json`, `config.json`, browser profiles, logs and local Node runtime are NOT packed in the distribution. Do not share exported cookies or run this on untrusted/shared PCs.

## Diagnostics and acceptance
- `node doctor.mjs`: inspect runtime, dependency, Chromium, configuration (without credential values).
- `npm test`: offline parser/session/verification unit tests; no real account or coursework updates.
- `node start.mjs --help`: CLI validation.
- A successful automated test does not imply the current Chaoxing UI is compatible.
- Never report complete if the authoritative platform response is missing or uncertain.
- Browser login may require manual verification or CAPTCHA. Do not bypass it.
- Windows login autostart remains opt-in; normal completion must not trigger an endless restart.
- The application is provided without a guarantee against platform rules or academic policies; check institutional requirements before use.
