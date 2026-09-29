// SPDX-License-Identifier: AGPL-3.0-or-later
// Build public/geo/cities.json from GeoNames cities15000 (CC BY 4.0).
// Usage: node scripts/build-gazetteer.mjs path/to/cities15000.txt [path/to/admin1CodesASCII.txt]
// (download from https://download.geonames.org/export/dump/)
import { readFileSync, writeFileSync } from "node:fs";

const [citiesPath, adminPath] = process.argv.slice(2);
if (!citiesPath) {
  console.error("usage: build-gazetteer.mjs cities15000.txt [admin1CodesASCII.txt]");
  process.exit(1);
}
const admin = new Map();
if (adminPath) {
  for (const line of readFileSync(adminPath, "utf8").split("\n")) {
    const [code, name] = line.split("\t");
    if (code) admin.set(code, name);
  }
}
const rows = [];
for (const line of readFileSync(citiesPath, "utf8").split("\n")) {
  const f = line.split("\t");
  if (f.length < 18) continue;
  const [, name, , , lat, lon, , , country, , admin1, , , , population, , , tz] = f;
  rows.push({ name, admin: admin.get(`${country}.${admin1}`) ?? "", country, lat: +(+lat).toFixed(3), lon: +(+lon).toFixed(3), tz, population: +population });
}
rows.sort((a, b) => b.population - a.population);
writeFileSync(
  new URL("../public/geo/cities.json", import.meta.url),
  JSON.stringify(rows.map((r) => [r.name, r.admin, r.country, r.lat, r.lon, r.tz])),
);
console.log(`wrote ${rows.length} places`);
