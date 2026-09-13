# Contributing

Thanks for helping improve Che Konam.

## Before you start

- Keep the project dependency-free and compatible with GitHub Pages.
- Preserve stable category and option IDs in both language catalogs.
- Keep user preferences local; do not add a backend or login flow without a separate design discussion.
- Test the main decision modes on a narrow viewport as well as a desktop viewport.

## Suggested workflow

1. Make a focused change.
2. Run `node scripts/validate-data.mjs`.
3. Run `node --check app.js`.
4. Open the site through a static server and test the affected flow.
5. Write a short commit message that describes the user-facing change.
