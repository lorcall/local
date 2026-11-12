# LoCal App Notes

LoCal is a personal calorie tracker for one user in the Philippines. You photograph a meal or a nutrition label, or describe the meal in words. Gemini estimates calories and macros, you review and correct the result, and every meal is saved as rows in your own Google Sheet.

## How it's built

- **Hosting:** Google Apps Script web app, free, runs in the user's Google account, only the owner can open it.
- **Database:** a Google Sheet, "LoCal log", with six tabs: Meals, Entries, Favorites, Targets, Weight, Settings.
- **Photos:** a Drive folder, "LoCal photos". The Sheet stores the Drive link and a small thumbnail.
- **AI:** Gemini API free tier, called only from the server. The key is the Script Property `GEMINI_API_KEY`. Tuned for speed: Gemini 3.5 Flash-Lite first with minimal thinking, then 3.8 Flash and 3.6 Flash. The model that answered is remembered.
- **Front end:** one page with 18+ screens, plain HTML, CSS and JavaScript, mobile first at 390 px wide.

## Design

"Graphite & Mango": dark neumorphism. Surfaces are raised out of, or pressed into, one graphite ground (#23252D). Mango (#F5A524) marks the one next action and progress. Mint (#7BE5C4) is protein, mango is carbs, violet (#A495FF) is fat, and coral (#FF7A6B) means over target, low confidence or delete. The font is Geologica. Selected tabs and chips are pressed in or raised; glass is used only for overlays. The logo is a dial three-quarters full with a glowing mango arc. On the loading screen, that arc spins with a fading trail.

## Features

**Logging**
- Photo of a meal (camera or gallery) with an optional note for the AI.
- Nutrition label scan that reads printed values; unreadable fields are flagged for you to fill in.
- Describe a meal in words, with no photo.
- Quick add from favorites, recent foods and past meals, plus a built-in Filipino dish list. None of these call the AI.
- Every meal has a date, time and meal type, all editable later. Meals can be copied to any date.

**Review and edit**
- Per-item calories, protein, carbs, fat, sugar, fiber and sodium, with high, medium or low confidence.
- Low-confidence items are highlighted.
- Changing grams or quantity rescales all values without another AI call.
- A calorie check: protein × 4 + carbs × 4 + fat × 9.
- "Use as my default for this dish" saves your corrections.

**Today**
- A calorie dial and protein, carbs and fat dials.
- Small sugar, fiber and sodium tiles.
- Coral warnings when over target.
- Swipe the dial, or use its arrows, to see other days.
- Swipe a meal left to edit, copy or delete it.

**Goals**
- A goal calculator using Mifflin-St Jeor, activity level and pace.
- Daily targets in grams or percent.
- Targets are versioned by date, so past days keep their old targets.

**Insights**
- History calendar and day summary with photos.
- 7 day, 30 day and custom trends, including a macro split.
- Weekly report with an AI-written summary of your numbers.
- Where your calories come from: top categories and your top five foods.
- Consistency streaks and a heatmap.
- Weight trend (moving average) against the change predicted from your intake.

**Settings**
- Links to the Sheet and the Drive folder.
- The AI model and how many analyses you've used today.
- Rice serving size and week start.
- CSV export.

## Files

- `apps-script/`: the deployable project (`Code.gs`, `sheets.gs`, `gemini.gs`, `index.html`, `styles.html`, `app.html`, `appsscript.json`).
- `icons/`: app icon, favicons and wordmarks.
- `preview.html`: the app in demo mode with sample data.
- `build/`: source files (`build/src/*.js` are bundled into `app.html` by `node build/build.js`) and tests.
- `README.md`: full setup guide, Sheet columns and troubleshooting.

## Status and open items

- Calorie values for kare-kare, lumpiang shanghai and pancit canton are still blank. Fill them in the app.
- Apps Script can't show a live camera viewfinder, so the phone's camera app opens instead. Adding to the home screen makes a browser shortcut, not an installed app.
- Possible next step: move from Apps Script to GitHub with free hosting and a database.
