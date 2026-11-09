// Challenge content. Edit names, miles, scenes or art here.
// `mile` is the running total where the stop sits. `x`,`y` place it on the map (viewBox 390 x 600).
// `art` is a small line drawing (viewBox 0 0 40 28) shown on its postcard.
export const TOTAL_MILES = 305;

export const STOPS = [
  { id: "conscription", name: "Conscription Day", mile: 0,   x: 70,  y: 540, sky: "#3a4a5e",
    art: "M8 26V12h24v14M8 12l12-9 12 9M17 26v-7h6v7",
    story: "You signed your name and walked through the gates. Everyone around you is weighing the odds. You came anyway." },
  { id: "parapet", name: "The Parapet", mile: 35,  x: 120, y: 490, sky: "#2f4a63",
    art: "M2 20h36M6 20c4-8 24-8 28 0M2 26c6-3 10-3 16 0s10 3 20 0",
    story: "A narrow stone bridge, wind pulling at your sleeves, a long drop on either side. You didn’t look down. You’re across." },
  { id: "challenges", name: "First Challenges", mile: 75, x: 230, y: 450, sky: "#4a3b33",
    art: "M6 24h28M10 24l4-12 6 6 6-6 4 12M20 4v6",
    story: "The mat, the squad, the bruises. You walked off it standing, and people are starting to notice." },
  { id: "gauntlet", name: "The Gauntlet", mile: 115, x: 300, y: 380, sky: "#3b3f52",
    art: "M4 26l10-18 6 8 8-14 8 24M24 6v4",
    story: "Every obvious way up was the wrong one. You found your own route to the top." },
  { id: "threshing", name: "Threshing", mile: 160, x: 190, y: 320, sky: "#5a3f30",
    art: "M20 26c-1-6-1-12 0-18M20 10c-5-6-12-7-18-4 5 1 8 4 9 8-4 0-7 1-9 4 6-1 12 1 18 6M20 10c5-6 12-7 18-4-5 1-8 4-9 8 4 0 7 1 9 4-6-1-12 1-18 6",
    story: "The valley goes quiet when the wings come down. More than halfway there, and you’ve been chosen." },
  { id: "flight", name: "First Flight", mile: 205, x: 90, y: 250, sky: "#34506a",
    art: "M4 20c8-2 14-8 16-14 2 6 8 12 16 14M12 24h16",
    story: "Seated, steady, and finally in the air. Your legs ache in ways you didn’t know they could." },
  { id: "wargames", name: "War Games", mile: 255, x: 210, y: 180, sky: "#4a2f2f",
    art: "M8 26V10l6-4v20M26 26V10l6-4v20M8 16h24M14 22h12",
    story: "Everything you’ve built gets tested at once. The end is close. Keep moving." },
  { id: "graduation", name: "Graduation", mile: 305, x: 300, y: 100, labelBelow: true, sky: "#5a4a2a",
    art: "M8 26V12h4V8h4v4h8V8h4v4h4v14zM17 26v-6a3 3 0 016 0v6",
    story: "You made it through the quadrant, and every mile was yours. Go claim your reward, rider." }
];

// Ways to log activity and how each converts to challenge miles.
export const TYPES = {
  miles:   { label: "Walk or run",   rule: "miles",            unit: "miles", ask: "How many miles?",        toMiles: a => a },
  steps:   { label: "Steps",         rule: "2,000 = 1 mile",   unit: "steps", ask: "How many steps?",        toMiles: a => a / 2000 },
  bike:    { label: "Cycling",       rule: "3 miles = 1 mile", unit: "miles", ask: "How many miles cycled?", toMiles: a => a / 3 },
  minutes: { label: "Other workout", rule: "20 min = 1 mile",  unit: "min",   ask: "How many minutes?",      toMiles: a => a / 20 }
};
