// Inlines the example map into the preview so the page is one self-contained file.
import { readFileSync, writeFileSync } from "node:fs";
const src = readFileSync(new URL("./preview.src.html", import.meta.url), "utf8");
const data = readFileSync(new URL("../examples/ca-secede.json", import.meta.url), "utf8");
writeFileSync(new URL("./preview.html", import.meta.url), src.replace("/*DATA*/", data.trim()));
