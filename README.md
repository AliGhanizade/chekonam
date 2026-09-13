# Che Konam

Che Konam is a small, static decision playground for everyday choices. Pick a topic, cross out options you do not want, then use hidden cards, automatic picking, or a scratch card to get a suggestion.

It is designed for personal use. There is no account, server, database, or sign-in flow. Your settings, custom boards, recent choices, and crossed-out options stay in your browser.

Live site: <https://alighanizade.github.io/chekonam/>

## What it includes

- Persian and English interface and catalogs.
- Fourteen everyday categories with varied list sizes from 36 to 65 options.
- Stable option IDs shared by both languages, such as `food-01`.
- Searchable lists with multi-select strike-through behavior.
- Per-category strike limit: total options minus seven.
- Three decision modes: hidden cards, automatic pick, and a single-card scratch reveal.
- A custom board saved locally in the browser.
- Five visual themes, light/dark/system color schemes, custom accent colors, adjustable corner radius, and optional 2D/3D depth.
- A local-only statistics drawer for visits and choices on the current browser.
- No audio files or playback permissions.

## Project structure

```text
index.html             Page structure and accessible controls
styles.css             Base layout and typography
theme-overrides.css    Themes, motion, responsive styling, and visual effects
app.js                 UI state, data loading, localStorage, and game logic
data.json              Category manifest and application settings
data/catalog.json      Persian catalog
data/catalog.en.json   English catalog
favicon.svg            Site icon
.github/workflows/     GitHub Pages deployment workflow
```

## Run locally

The browser needs a static server to load the JSON files. From the project directory, run:

```bash
python -m http.server 4173
```

Then open <http://localhost:4173>.

No build step and no package installation are required.

## Data and customization

Each catalog entry has the same shape in both languages:

```json
{
  "id": "food-01",
  "title": "Herb stew",
  "description": "A familiar home-cooking option."
}
```

Keep the category IDs and option IDs identical between `data/catalog.json` and `data/catalog.en.json`. The application uses those IDs to preserve crossed-out options when the language changes or the page is revisited.

To add or edit a category:

1. Add the category to both catalog files with the same category ID.
2. Add the matching category metadata to `data.json`.
3. Keep option IDs stable once the site is in use, otherwise existing browser preferences cannot be matched.

## GitHub Pages

The workflow in `.github/workflows/pages.yml` publishes the repository to GitHub Pages whenever `main` changes. The site is plain HTML, CSS, JavaScript, and JSON, so it works with GitHub Pages and other static hosts.

## Privacy and local storage

The site does not send choices to a backend. The admin drawer is intentionally local: it shows activity recorded in the current browser only, not total visitors across the public site.

## License

Released under the MIT License. See [LICENSE](LICENSE).
