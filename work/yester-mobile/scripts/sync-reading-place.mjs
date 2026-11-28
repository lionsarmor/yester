// Bundle the same document script used by the member gateway for offline native use.
import { readFileSync, writeFileSync } from 'node:fs';
const script = readFileSync(new URL('../../yestersites-edition/src/reading-place.js', import.meta.url),'utf8');
writeFileSync(new URL('../src/readingPlaceScript.json', import.meta.url), JSON.stringify({script},null,2)+'\n');
