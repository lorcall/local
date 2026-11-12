# LoCal

A personal calorie tracker that runs in your own Google account. Photograph a meal or a nutrition label, Gemini estimates calories and macros, you review and save, and every meal becomes a row in your Google Sheet.

- **Hosting:** Google Apps Script web app (free, in your account)
- **Database:** a Google Sheet called "LoCal log" with six tabs
- **Photos:** a Drive folder called "LoCal photos" (the Sheet keeps the link and a small thumbnail)
- **AI:** Gemini API free tier, called only from the server with a key stored in Script Properties

## What's in this folder

| Path | What it is |
| --- | --- |
| `apps-script/Code.gs` | Web app entry and the server functions the page calls |
| `apps-script/sheets.gs` | Reads and writes the Sheet; creates tabs and columns |
| `apps-script/gemini.gs` | Photo, label, single-item and weekly-summary calls to Gemini |
| `apps-script/index.html` | The page shell (Apps Script include pattern) |
| `apps-script/styles.html` | Graphite & Mango tokens, depth classes and components |
| `apps-script/app.html` | The whole front end: 18 screens, router, charts, calculations |
| `apps-script/appsscript.json` | Manifest: Manila time zone, web app runs as you, only you can open it |
| `icons/` | App icon, maskable icon, favicons and wordmarks (SVG and PNG) |
| `preview.html` | The same app in demo mode with sample data, no Google needed |
| `build/` | Source files, build script and the tests used to check the app |

## Set it up (about 10 minutes)

1. **Get a Gemini API key.** Go to aistudio.google.com/apikey, sign in, and create a key. No billing account is needed. If the Philippines isn't offered for the free tier, the key page will say so.
2. **Make the Sheet and open its script.** Create a new Google Sheet (sheets.new), name it `LoCal log`, then choose **Extensions › Apps Script**. The script is now tied to this Sheet, and LoCal will use it as the database.
3. **Add the files.** In the Apps Script editor:
   - Open **Project Settings** (gear icon) and tick **Show "appsscript.json" manifest file in editor**. Back in the editor, replace `appsscript.json` with the one from this folder.
   - Replace everything in `Code.gs` with `Code.gs` from this folder.
   - Add **Script** files named `sheets` and `gemini` and paste `sheets.gs` and `gemini.gs`.
   - Add **HTML** files named `index`, `styles` and `app` and paste the matching `.html` files. The names must match exactly, without the extension.
4. **Store the key.** **Project Settings › Script Properties › Add script property:** name `GEMINI_API_KEY`, value your key. Save.
5. **Deploy.** **Deploy › New deployment › Select type: Web app.** Execute as: **Me**. Who has access: **Only myself**. Click **Deploy**, approve the permissions (Sheets, Drive, and connecting to an external service for Gemini), and copy the web app URL that ends in `/exec`.
6. **Open it on your phone.** Open the `/exec` URL in Chrome or Safari while signed in to the same Google account, tap **Connect Google account**, set your goal, and add the page to your home screen (**Share › Add to Home Screen** on iPhone, **⋮ › Add to Home screen** on Android).

To update after you change code: **Deploy › Manage deployments › Edit (pencil) › Version: New version › Deploy.** The `/exec` link stays the same.

Prefer the command line? `npm i -g @google/clasp`, `clasp login`, `clasp create --type sheets --title "LoCal log" --rootDir apps-script`, then `clasp push` and deploy as in step 5.

## How it behaves

- **Photo analysis** resizes the photo to 768 px on the phone and sends it with your note, your rice serving and your saved Filipino dishes to Gemini, while a parallel call saves the photo to Drive. Your note is treated as more reliable than the photo.
- **Nothing is saved until you press Save.** Every item is editable; changing grams or quantity rescales all seven values without another AI call.
- **Quick add, favorites, copied meals and Filipino dishes never call Gemini**, which saves free quota. Settings shows how many photos were analyzed today.
- **Targets are versioned.** Saving new targets applies from today; past days are judged against the target they had.
- **Calculations:** calories check uses protein×4 + carbs×4 + fat×9 (flags items off by more than 10%); goal calculator uses Mifflin-St Jeor with activity factors 1.2, 1.375, 1.55 and 1.725, a deficit of pace × 7,700 ÷ 7, protein 1.65 g per kg, fat 30% of calories, carbs the rest; weight trend is an exponential moving average (alpha 0.1); predicted change is the sum of (intake − maintenance) ÷ 7,700.
- **On target** means calories at or under the day's target. Consistency's "within 10%" means within ±10%. A protein day counts when protein reaches at least 90% of its target.

## The Sheet

Six tabs, created on first run. Columns are matched by header name, so you can add your own columns or reorder them.

| Tab | One row per | Columns |
| --- | --- | --- |
| Meals | Meal | meal_id, date, time, meal_type, photo_url, note, confidence, confidence_reason, source, edited, thumb |
| Entries | Food item | entry_id, meal_id, name, category, serving_unit, grams_per_unit, serving_label, quantity, kcal, protein_g, carbs_g, fat_g, sugar_g, fiber_g, sodium_mg, confidence, edited, reason |
| Favorites | Saved food or dish | food_id, name, category, serving_unit, grams_per_unit, serving_label, the seven values, pinned, use_count, usual_hour, last_used, is_local_dish, dish_group, user_corrected |
| Targets | Target change | effective_date, kcal, protein_g, carbs_g, fat_g, fiber_min_g, sugar_max_g, sodium_max_mg (0 means off) |
| Weight | Weigh-in | date, kg, note |
| Settings | Setting | key, value |

Compared with the design notes, a few columns were added: `thumb` and `reason` (show photos and low-confidence reasons without extra calls), `serving_label` (portions like "5 pieces"), `last_used` (the Recent tab), and `dish_group` (Ulam, Rice, Soup, Street food, Merienda chips).

## What's new in version 2

- **Other days on Today:** use the arrows beside the dial, or swipe the dial, to see other days. "Back to today" returns. Meals you log while looking at a day go to that day.
- **Date and time on every meal:** logging, describing, quick add and the label screen all have date and time fields. Open a saved meal to change its date, time or meal type.
- **Copy to any date:** swipe a meal left, tap Copy, then "Copy to another date or meal".
- **Describe a meal:** type what you ate ("1 bowl tinola, 2 cups rice") and Gemini estimates it, no photo needed. It uses one AI analysis.
- **Over-target warnings:** the dial, macro rings and nutrient tiles turn coral past the target, and a warning line lists what is over.
- **Sugar, fiber and sodium tiles** replace the plain text strip.
- **Photos:** a meal's photo shows when you open it, and tapping it loads the full photo from Drive. Thumbnails load only for the meals on screen, so the app still opens fast.
- **Logo** on Today and on the loading screen, which now appears before the app's code finishes loading.

## Things to know

- **Gemini models, tuned for speed.** `gemini.gs` tries `gemini-3.5-flash-lite` first (the fastest, thinking set to minimal), then `gemini-3.8-flash` and `gemini-3.6-flash` (thinking set to low), all listed as free tier on Google's pricing page in October 2026. It remembers the model that answered and goes straight to it next time. Photos are sent at 768 px, and the Drive upload runs alongside the analysis instead of before it. If estimates feel less accurate, add a Script Property `GEMINI_MODEL` set to `gemini-3.8-flash`; it is slower but recognizes dishes better. Google sets and changes the free limits; you can see yours at aistudio.google.com/rate-limit.
- **Camera:** Apps Script pages run inside a Google frame that can't show a live camera viewfinder, so the shutter button opens your phone's camera app and returns the photo. Gallery and label scans work the same way.
- **Home screen:** Apps Script can't serve a web app manifest, so "Add to Home Screen" makes a shortcut that opens in the browser rather than a full-screen installed app. To set the tab icon, host `icons/icon-192.png` somewhere public and add its URL as Script Property `ICON_URL`.
- **Placeholders to fill:** kare-kare, lumpiang shanghai and pancit canton have no calorie values yet. Tap **Set kcal** next to each in Filipino dishes, or type them into the Favorites tab.
- **Privacy:** meal photos and notes go to Google's Gemini API. On the free tier Google may use them to improve its products. Everything else stays in your Sheet and Drive. Weekly summaries send only the computed numbers, never photos.
- **Deleting a meal** removes its Meals and Entries rows. The photo stays in the Drive folder.
- The estimates and the goal calculator are general guidance, not medical advice.

## Troubleshooting

- **Photo analysis fails:** in the script editor, pick `testGemini` in the function menu and press **Run**. The first run asks for permission to connect to an external service; approve it. The Execution log shows whether your key is found, which model answered, and how many seconds a call takes. A "Working route" line means analysis will work. Then deploy a new version.
- **"The meta tag you specified is not allowed":** you have an older `Code.gs`. Replace it with the current one and deploy a new version.
