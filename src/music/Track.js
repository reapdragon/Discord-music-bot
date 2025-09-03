export class Track {
    meta;
    constructor(meta) {
        this.meta = meta;
    }
    toString() { return `${this.meta.title} (${this.meta.source})`; }
}
