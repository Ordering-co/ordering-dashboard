# Ordering.co Dashboard

Copy this prompt into your coding agent:

> Set up the Dashboard from https://github.com/Ordering-co/ordering-dashboard.git for my Ordering project. Reuse my existing connection after I confirm the project, or guide me through manual setup. Start it locally, check the login screen, and help me make a first visible edit. Keep changes local.

## Your first Dashboard

1. **Open your agent and paste the prompt.** It prepares a local copy. You need Node 24, pnpm 9.15.0, and an Ordering project you own or are authorized to use.
2. **Confirm your project.** Your agent checks an existing connection before reusing it. If you have none, provide your project slug and follow [manual setup](setup.md#configuration-and-startup). Look for confirmation that your project is configured and its public API responds; this does not prove account permissions. No keys need to be copied into the app.
3. **Open the local URL.** Check that the login shows your selected project. Ask your agent to make a [first visible edit](docs/onboarding-runbook.md#first-visible-edit), watch it update, and restore it. Use your normal account to sign in when you need private data.

For manual commands, requirements, and optional services, read [setup.md](setup.md). For troubleshooting, project changes, updates, and disconnecting, use [the runbook](docs/onboarding-runbook.md). This source does not provision a backend or grant production access; no connection-selector screen is required for this setup.

## Code and license

The UI, business controllers, and SDK live in this repository. [Ordering.co Source License v1.2](LICENSE-ORDERING) applies to this source. Existing third-party notices remain applicable. Read the terms before using or redistributing it.
