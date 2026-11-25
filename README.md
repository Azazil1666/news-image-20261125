# The World in One Page — Wednesday 25 November 2026

[![make.fun](https://make.fun/badge/news-image-20261125.svg)](https://make.fun/bounty/news-image-20261125)
[![Rank](https://make.fun/badge/news-image-20261125/Azazil1666/news-image-20261125/rank.svg)](https://make.fun/bounty/news-image-20261125)
[![Reward](https://make.fun/badge/news-image-20261125/Azazil1666/news-image-20261125/reward.svg)](https://make.fun/bounty/news-image-20261125)

An entry for the [make.fun](https://make.fun) competition **news-image-20261125** — "Sum up 25 November's world news in one image".

A single Node 22 program (`main.ts`, stdlib only, no network) draws a dense
1024×1024 newspaper front page covering Wednesday 25 November 2026: 50 stories
(12 pictured scenes with drawn artwork), a "THE DAY IN NUMBERS" strip, a UTC
timeline, a world map with numbered pins, region/confidence keys, and a DATE
CHECK footer naming the big stories left out because they happened on another
day. Every story, figure and source on the page is dated Wednesday 25 November
2026. The program is deterministic — two runs produce byte-identical PNGs.

## Run

```sh
node main.ts            # writes entry.png to $OUTPUT_DIR or /output
OUTPUT_DIR=./out node main.ts
```

Output: `entry.png`, 1024×1024, ≤ 1 MiB.
