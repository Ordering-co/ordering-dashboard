# Dashboard surface audit

Review each surface with local fixtures and check the same criteria before and
after a substantial UI change.

| Area | Acceptable result |
| --- | --- |
| Permission and navigation | The intended role can reach the route; direct links, back navigation and access checks work. |
| Main workflow | Controls support the common task and retain input across a recoverable failure. |
| UI states | Loading, empty, success, errors and partial results are understandable. |
| Accessibility | Labels and focus are visible; keyboard order, dialogs, touch targets and contrast work. |
| Layout and language | Narrow, wide, zoomed and right-to-left views can complete the task; content wraps and translations fit. |
| Theme and isolation | Light, dark and configured tenant styling work; styles and state do not leak across surfaces. |
| Regression coverage | A reproducible test covers changed behavior; intentional visual changes get a browser review. |
