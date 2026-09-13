# Data format

The app reads category metadata from `data.json` and localized options from the two catalog files.

Each catalog uses a category ID and a list of option objects:

```json
{
  "id": "food",
  "title": "What should I cook?",
  "items": [
    {
      "id": "food-01",
      "title": "Herb stew",
      "description": "A familiar home-cooking option."
    }
  ]
}
```

The Persian and English files must contain the same category IDs and option IDs in the same order. Titles and descriptions may be localized.
