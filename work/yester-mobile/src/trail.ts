import type { Visit } from "./discovery";
import type { ReadingPlace } from "./readingPlace";
export type Entry = Visit & { session: number; place?: ReadingPlace };
export class Trail {
  entries: Entry[] = [];
  index = -1;
  get current() {
    return this.entries[this.index];
  }
  get back() {
    return this.index > 0;
  }
  get forward() {
    return this.index + 1 < this.entries.length;
  }
  push(entry: Entry) {
    if (
      entry.url === this.current?.url &&
      entry.session === this.current.session
    ) {
      this.entries[this.index] = {...this.current,...entry};
      return;
    }
    this.entries.splice(this.index + 1, Infinity, entry);
    this.index++;
  }
  move(direction: -1 | 1) {
    const target = this.entries[this.index + direction];
    if (target) this.index += direction;
    return target;
  }
}
