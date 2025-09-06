export class Queue {
    items = [];
    enqueue(track) {
        this.items.push(track);
    }
    dequeue() {
        return this.items.shift();
    }
    peek() {
        return this.items[0];
    }
    clear() {
        this.items = [];
    }
    removeAt(index) {
        if (index < 0 || index >= this.items.length)
            return undefined;
        const [removed] = this.items.splice(index, 1);
        return removed;
    }
    shuffle() {
        for (let i = this.items.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [this.items[i], this.items[j]] = [this.items[j], this.items[i]];
        }
    }
    // Optional: keep this getter; it’s fine
    get length() {
        return this.items.length;
    }
    // Use this in Player to compute size safely
    get tracks() {
        return [...this.items];
    }
}
