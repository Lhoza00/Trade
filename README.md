# Trading & Wellbeing Journal

A private, mobile-first journal for trading analysis, reviews and wellbeing. Plain HTML, CSS and JavaScript. No build step, no server, no accounts. Everything is stored in your phone's browser (localStorage).

## Put it on GitHub Pages
1. Create a new GitHub repository and upload everything in this folder, keeping the `css/`, `js/` and `icons/` folders.
2. Repository Settings, then Pages, then Source: "Deploy from a branch", branch `main`, folder `/ (root)`.
3. Open the Pages address on your phone.
4. Install it: Android Chrome menu, "Install app". iPhone Safari Share button, "Add to Home Screen".

## Updating the app later
Upload the changed files to the repo. The app refreshes itself quietly, so open it twice to see the new version. To force a clean refresh, change `CACHE = 'tj-shell-v7'` in `sw.js` to a new name (for example `v8`).

## Your data
- It lives in the browser on that one phone. Clearing site data erases it.
- Settings has a storage meter, Download backup, Restore (merge or replace) and Erase.
- Browser storage is roughly 5 MB. Pictures are shrunk before saving, and the meter warns when space runs low.
- Installing to the Home Screen also protects it from Safari's automatic clean-up.

## Pages
| Page | Purpose |
|---|---|
| `index.html` | Dashboard: today's analysis, wellbeing check-in, summary, recent cards |
| `calendar.html` | Month grid, tap a day for its analysis, trades and check-in |
| `create.html` | New analysis or trade (Stage 1 forecast with pictures) |
| `entry.html?id=` | Open a card: edit forecast, Stage 2 outcome, Stage 3 verdict |
| `library.html` | Lessons, strategies, mistakes, reference |
| `progress.html` | Accuracy, weekly reviews, recurring mistakes, setups, wellbeing vs plan |
| `settings.html` | Storage, backup, restore, install, erase |

`plan.json` records how the build was split into steps and what each one contains.
