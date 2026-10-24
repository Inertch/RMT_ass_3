# Mini-LMS rendering benchmark (Assignment 3 prototype)

Compares client-side rendering (CSR), server-side rendering (SSR) and static site generation (SSG)
on four LMS-style pages (dashboard, gradebook, quiz, forum) under three emulated network profiles.
All data are synthetic and seeded; no personal data are used.

## Requirements
Node.js 18+ (record your exact version), Python 3.10+, Git.

## Run order
1. `git init && git add . && git commit -m "initial prototype"`   (the commit hash is written into every result row)
2. `npm install`
3. `npx playwright install chromium`
4. `npm run build` then `npm start`   (leave running; production mode at http://127.0.0.1:3000)
5. In a second terminal: `npm run check`    -> functional equivalence test (CSR = SSR = SSG content)
6. `npm run pilot`                           -> 5 loads per condition (script and variance check)
7. `npm run bench`                           -> 30 loads per condition = 1,080 measured loads (several hours possible on slow profiles)
8. `pip install -r analysis/requirements.txt`
9. `python analysis/analyze.py results/main/raw_results.csv results/main/analysis`

## Measurement conditions
Close other applications, keep the laptop plugged in with a fixed power mode, do not use the machine while the benchmark runs.
Do not edit the code between the pilot and the main run without committing and noting it.

## Known limitations of this prototype
No authentication; localhost server; single browser (Chromium); emulated (not real) network; synthetic data;
SSG data are frozen at build time; CPU is not throttled.
