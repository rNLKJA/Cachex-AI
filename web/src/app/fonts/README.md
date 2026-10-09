# Self-hosted fonts

These are the latin subsets of the site's three typefaces. They are loaded with `next/font/local` in `src/app/layout.tsx`, so a build never has to reach Google Fonts.

| File                                          | Source package (npm pack)                        | Axis            | Variable            |
| --------------------------------------------- | ------------------------------------------------ | --------------- | ------------------- |
| `bricolage-grotesque-latin-wght-normal.woff2` | `@fontsource-variable/bricolage-grotesque@5.3.0` | wght 200 to 800 | `--font-display`    |
| `geist-latin-wght-normal.woff2`               | `@fontsource-variable/geist@5.3.0`               | wght 100 to 900 | `--font-geist-sans` |
| `geist-mono-latin-wght-normal.woff2`          | `@fontsource-variable/geist-mono@5.3.0`          | wght 100 to 900 | `--font-geist-mono` |

All three families are licensed under the SIL Open Font License 1.1. The licence for each family sits next to its files as `OFL-*.txt`.
