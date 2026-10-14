# Public source code

The Dashboard's Open Source Code page provides repository, README, setup, fork and clone controls. Access is restricted to enabled administrators (level0), including when the session role changes. It does not fetch ZIP catalogs or archives and does not require an authenticated GitHub API request.

## Repositories and setup

| Product or tool | Repository | Setup |
| --- | --- | --- |
| Dashboard | [ordering-dashboard](https://github.com/Ordering-co/ordering-dashboard) | [setup.md](https://github.com/Ordering-co/ordering-dashboard/blob/main/setup.md) |
| Website Marketplace | [website-marketplace](https://github.com/Ordering-co/website-marketplace) | [setup.md](https://github.com/Ordering-co/website-marketplace/blob/main/setup.md) |
| Customer App Marketplace | [ordering-app-marketplace](https://github.com/Ordering-co/ordering-app-marketplace) | [README.md](https://github.com/Ordering-co/ordering-app-marketplace/blob/main/README.md) |
| Business App | [ordering-app-business](https://github.com/Ordering-co/ordering-app-business) | [README.md](https://github.com/Ordering-co/ordering-app-business/blob/main/README.md) |
| Driver App | [ordering-app-driver](https://github.com/Ordering-co/ordering-app-driver) | [README.md](https://github.com/Ordering-co/ordering-app-driver/blob/main/README.md) |
| Franchise Website | [ordering-website-franchises](https://github.com/Ordering-co/ordering-website-franchises) | [setup.md](https://github.com/Ordering-co/ordering-website-franchises/blob/main/setup.md) |
| Franchise App | [ordering-app-franchises](https://github.com/Ordering-co/ordering-app-franchises) | [README.md](https://github.com/Ordering-co/ordering-app-franchises/blob/main/README.md) |
| Developer Quickstart | [ordering-dev-quickstart](https://github.com/Ordering-co/ordering-dev-quickstart) | [SETUP.md](https://github.com/Ordering-co/ordering-dev-quickstart/blob/main/SETUP.md) |
| MCP plugin and skill | [ordering-mcp-plugin](https://github.com/Ordering-co/ordering-mcp-plugin) | [README.md](https://github.com/Ordering-co/ordering-mcp-plugin/blob/main/README.md) |

Read each repository's requirements, applicable license and third-party notices. Public visibility does not grant access to an Ordering API project, provision a backend, configure a tenant or imply that the source is already deployed. Mobile products also require their own provider configuration, signing and build tools.

Developer Quickstart provides this setup prompt:

```text
Connect me to Ordering.co: clone https://github.com/Ordering-co/ordering-dev-quickstart to ~/ordering-dev-quickstart (or pull it if I already have it), then read its SETUP.md and follow it step by step.
```

Quickstart establishes an MCP connection for an agent. It does not configure all seven frontend products. The plugin supplies platform guidance for an existing connection; normal project authentication still applies.

Clone commands for products with a shared SDK use `--recurse-submodules`. Clipboard failures leave the command selectable and keep keyboard focus. The page supports translated labels and right-to-left layout without fetching ZIP instructions.

## Legacy services

The [legacy backend contract](SOURCE_CODE_DOWNLOADS.md) describes optional Worker endpoints retained for other consumers. Repository navigation does not delete storage objects, alter credentials or change deployments. Retiring those services requires a separate review of their consumers.

## Verification

Run the quality commands in [setup.md](../setup.md), including frozen installation, build, lint, translations, tests and command-palette coverage. Verify repository URLs, safe external links, clipboard feedback and administrator authorization. UI fixtures are distinct from a live login, tenant configuration, fork creation or deployment.
