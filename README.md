# Riders Quadrant

A virtual mileage challenge tracker. Log walks, runs, steps, cycling or workouts and move along a
305-mile dragon-rider journey on an illustrated map. Each of the eight stops unlocks a postcard, and
every stop after the start can carry a reward you picked.

Static site (no build step) hosted on GitHub Pages, with Firebase for sign-in and cloud sync.
Installable to an iPhone home screen and works offline.

## Setup

### 1. Firebase (free Spark plan)
1. Go to https://console.firebase.google.com and create a project. Google Analytics can be off.
2. **Build → Authentication → Get started → Sign-in method → Email/Password → Enable.**
3. **Build → Firestore Database → Create database.** Pick a US location, start in production mode.
4. In Firestore, open the **Rules** tab, paste in the contents of `firestore.rules`, and publish.
5. **Project settings (gear) → General → Your apps → Web (`</>`).** Register an app (no Hosting needed).
   Copy the `firebaseConfig` values into `firebase-config.js`.
6. **Authentication → Settings → Authorized domains → Add domain:** `YOUR-USERNAME.github.io`

The Firebase web config is not a secret; it is safe in a public repo. The Firestore rules are what keep
each person's data private.

### 2. GitHub Pages
1. Create a repo (for example `riders-quadrant`) and push these files to the `main` branch.
2. **Settings → Pages → Build and deployment → Deploy from a branch → `main` / root → Save.**
3. The site is live at `https://YOUR-USERNAME.github.io/riders-quadrant/` in a minute or two.

### 3. Install on iPhone
Open the link in Safari → Share → **Add to Home Screen**. It then opens full screen like an app.

## Updating
Change files, then bump `VERSION` in `sw.js` so installed copies pick up the new version.

## Files
- `content.js`: the stops (names, miles, map positions, postcard scenes and art) and activity conversions
- `index.html`: screens (sign in, map, log, postcards, logbook, rewards)
- `styles.css`: theme
- `app.js`: logic, milestones, conversions, Firebase reads and writes
- `firebase-config.js`: your Firebase project keys
- `firestore.rules`: database security rules
- `sw.js`, `manifest.webmanifest`, `icons/`: offline support and home-screen install

## Syncing steps from Zepp (iPhone)
A website can't read Apple Health directly, so an iPhone Shortcut reads the steps and opens the app
with them in the link. The Shortcut sends **each of the last 7 days**, so a day when the Shortcut
didn't run is still picked up the next time it does (as long as that's within a week):

`?sync=health&days=2026-11-12:8421;2026-11-13:6050;2026-11-14:9120`

The app saves one "From Health app" entry per day (id `health-YYYY-MM-DD`). Sending a day again
updates it instead of adding to it, and a day's total only ever goes up, so the oldest day being cut
short by the 7-day window never lowers it. (The older one-day link, `?sync=health&steps=8421` with
optional `&miles=3.4` and `&date=YYYY-MM-DD`, still works. Add `&unit=miles` to a `days` link if the
numbers are miles.)

### Step 1: Let Zepp write to Apple Health
**Zepp → Profile → Add accounts → Apple Health**, and allow it to write **Steps**.

### Step 2: Build the Shortcut
Open the **Shortcuts** app → **+** (top right) to make a new shortcut. Add these actions in this
order (tap **Search for apps and actions** to find each one):

1. **Find Health Samples**
   - Tap **Type** → **Steps**.
   - Tap **Add Filter**, set it to **Start Date** · **is in the last** · **7** · **days**.
   - Tap **Add Filter** again, set it to **Source** · **is** · **Zepp** (otherwise iPhone and Zepp
     steps both get counted).
   - Tap the arrow or **Show More** on the action and set **Group By** to **Day**. This turns the
     samples into one total per day.
2. **Repeat with Each** → it should fill in **Health Samples** by itself. The next actions go
   *inside* the repeat (between "Repeat with each" and "End Repeat").
3. **Format Date** (inside the repeat)
   - Tap the date field → pick **Repeat Item**, then tap **Repeat Item** again and choose
     **Start Date**.
   - Set **Date Format** to **Custom** and type `yyyy-MM-dd` exactly (lowercase y and d, capital M).
4. **Get Details of Health Sample** (inside the repeat)
   - Set it to get **Value** of **Repeat Item**.
5. **Text** (inside the repeat). Make it read exactly:
   **Formatted Date** `:` **Value**
   (insert the Formatted Date variable, type a colon, then insert the Value variable; no spaces).
6. **Combine Text** (after **End Repeat**)
   - It should use **Repeat Results**. Tap **New Lines** and change it to **Custom**, then type `;`
7. **URL**: type `https://YOUR-USERNAME.github.io/riders-quadrant/?sync=health&days=` and then insert
   the **Combined Text** variable at the end.
8. **Open URLs**.

Tap the name at the top, call it "Sync Riders Quadrant", and tap **Done**. Run it once by hand and
allow Health access when asked. The app should open and say "Synced 7 days from Health" (or "already
up to date").

### Step 3: Run it automatically
**Shortcuts → Automation → + → App → Zepp → Is Closed → Run Immediately** → pick the shortcut.
Zepp pushes watch data to Health when it's opened, so closing Zepp is a good moment to sync.

The link opens in Safari, which keeps its own sign-in separate from the home-screen app: sign in
once in Safari too. Don't also log walks or steps by hand, or they'll count twice; manual logging is
still right for cycling and other workouts.

## Data model
```
users/{uid}                         { currentChallenge }
users/{uid}/challenges/{id}         { totalMiles, rewards: { <stopId>: { name, url, claimed } }, startedAt }
users/{uid}/challenges/{id}/entries/{id}  { type, amount, miles, date, note, source, createdMs, createdAt }
```
Starting a new challenge (Settings) keeps the old one in the database and carries the reward list over.

## Conversions
Walk or run 1:1 · Steps 2,000 = 1 mile · Cycling 3 miles = 1 mile · Other workout 20 min = 1 mile.
Edit `TYPES` and `STOPS` in `content.js` to change them.
