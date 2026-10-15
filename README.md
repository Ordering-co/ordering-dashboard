# Ordering.co Dashboard

Copy this prompt into your coding agent:

> Set up https://github.com/Ordering-co/ordering-dashboard.git, preserving my existing checkout. Read setup.md. Detect my existing connection and confirm the project before reuse, or guide me through manual setup. Start locally, verify the selected-project login, and help me see one edit update automatically. Keep changes local.

## Your first local Dashboard

1. **Paste the prompt in your agent.** Reuse your checkout or prepare a local copy. Local onboarding uses Node 24 and pnpm 9.15.0.
2. **Confirm your project.** Reuse an existing connection only after confirming its slug, or provide your authorized slug for [manual setup](setup.md#configuration-and-startup). Public project validation checks resolution, not account permissions; no agent key needs to be copied into the app.
3. **Open the local URL.** After explicit local setup, check the selected project on the login screen, make a [first visible edit](docs/onboarding-runbook.md#first-visible-edit), and restore it. Sign in with your own normal account when you need private data.

The [setup guide](setup.md) and [onboarding runbook](docs/onboarding-runbook.md) cover configuration, diagnostics, project changes, updates, and restore. Preserve existing configuration and keep execution evidence outside the product repository.

Source code for the Ordering.co administration Dashboard. The UI, business controllers and SDK live in this repository.

## Get started

```sh
git clone https://github.com/Ordering-co/ordering-dashboard.git
cd ordering-dashboard
pnpm install --frozen-lockfile
```

Read [setup.md](setup.md) for configuration, development commands and optional services. This client requires an Ordering.co project you own or are authorized to use; public source does not grant API access or provision a backend.

## License

[Ordering.co Source License v1.2](LICENSE-ORDERING) applies to this source. Existing third-party notices remain applicable. Read the license terms before using or redistributing it.

## Open Source Code

The Dashboard page links to seven public product repositories and two developer tools. See [public source code](docs/public-source-code.md) for repository links, setup guidance and access requirements.
