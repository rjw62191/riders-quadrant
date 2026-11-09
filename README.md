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
