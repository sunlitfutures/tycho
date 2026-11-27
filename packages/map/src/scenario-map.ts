/**
 * Tycho v0: the data behind a scenario map.
 *
 * A map answers one question and reads left to right in columns: where it
 * starts, one column per hinge point, then the outcomes. Each path is one way
 * things can go, from the start to an outcome, with the share of runs that
 * went that way.
 *
 * Why paths and not links: a link only says how much flows from A to B, and it
 * forgets which road led to A. A path keeps the whole road. So a flow can be
 * colored by where it ends, a path can be traced end to end, and the shares
 * can be checked: they add up to 1.
 */
export type ScenarioMap = {
  format: "tycho.map/0";
  question: string;
  columns: Column[];
  nodes: MapNode[];
  paths: Path[];
};

/** One column, left to right: the start, a hinge point, or the outcomes. */
export type Column = {
  id: string;
  label: string; // "Leverage"
};

/** One state a column can be in. */
export type MapNode = {
  id: string;
  column: string; // a Column id
  label: string; // "Serious leverage"
  /** Attributes to sort and group by, like { ca_status: "Still in the US" }. */
  tags?: Record<string, string>;
};

/** One way things go, from the start to an outcome. */
export type Path = {
  /** Node ids left to right, one per column it passes. It may skip a column. */
  through: string[];
  /** The fraction of runs that went this way, 0 to 1. All paths add up to 1. */
  share: number;
};
