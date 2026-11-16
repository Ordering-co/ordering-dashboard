# Dashboard UI maintenance

Start with the [surface maintenance playbook](../REDESIGN_PLAYBOOK.md).
Use the [audit rubric](audit-rubric.md) to review a surface and the
[brand guide](../BRAND.md) for tokens, wrappers and the two CSS pipelines.

The guards under `scripts/redesign/` protect route dependencies, order imports
and date handling. Keep the baselines used by automated assertions. Review a
baseline diff for intentional improvements; use local synthetic fixtures for
browser, layout and performance checks.
