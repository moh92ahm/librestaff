# Security Policy

## Supported versions

Security fixes are made on the latest release of LibreStaff. Before reporting a problem, verify
that it is still present on the current `main` branch.

## Reporting a vulnerability

Please do not open a public issue for a suspected vulnerability. Use GitHub's private
[security advisory form](https://github.com/moh92ahm/librestaff/security/advisories/new) instead.

Include the affected version or commit, reproduction steps, impact, and any suggested mitigation.
Do not access data that is not yours, disrupt a running service, or publish the issue before a fix
is available. You should receive an initial response within seven days.

## Deployment responsibility

Operators should use unique random values for `NEXTAUTH_SECRET`, `SETUP_SECRET`, `CRON_SECRET`, and
`EMAIL_SETTINGS_ENCRYPTION_KEY`; serve the application over HTTPS; keep dependencies updated; and
restrict database and media-storage access to the application.
