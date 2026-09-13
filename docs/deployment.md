# Deployment

Che Konam is deployed as a static GitHub Pages site.

1. Push changes to `main`.
2. The workflow in `.github/workflows/pages.yml` uploads the repository as a Pages artifact.
3. GitHub Pages serves the site from the configured Pages environment.

For local checks, use a static server instead of opening `index.html` directly so that `fetch()` can read the JSON files.
