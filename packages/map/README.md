# @tycho/map

The scenario map format (`tycho.map/0`) and its view.

- `src/scenario-map.ts`: the type. A map answers one question in columns, left to right. Each path is one way things can go, with the share of runs that went that way.
- `examples/ca-secede.json`: a sample map with made-up numbers.
- `preview/preview.src.html`: a self-contained view of a map. `pnpm --filter @tycho/map preview` writes `preview/preview.html` with the example inlined.
