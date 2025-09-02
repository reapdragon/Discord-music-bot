export class Queue {
    connection = null;
    tracks = [];
    loop = false;
    volume = 0.5;
    enqueue(t) { this.tracks.push(t); }
    dequeue() { return this.tracks.shift(); }
    peek() { return this.tracks[0]; }
    isEmpty() { return this.tracks.length === 0; }
    clear() { this.tracks = []; }
}
