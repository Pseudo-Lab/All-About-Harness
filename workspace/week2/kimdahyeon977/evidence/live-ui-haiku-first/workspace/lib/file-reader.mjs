import { createReadStream, watch, existsSync } from 'node:fs';
import { readFile, stat } from 'node:fs/promises';
import { EventEmitter } from 'node:events';

export class EventFileReader extends EventEmitter {
  constructor(filePath) {
    super();
    this.filePath = filePath;
    this.events = [];
    this.lastSeq = 0;
    this.watchHandle = null;
    this.reading = false;
    this.fileSize = 0;
    this.lastSentSeq = -1;
    this.initialized = false;
    this.lastProcessedOffset = 0;
  }

  async ready() {
    if (!this.initialized) {
      await this.loadFile();
      this.watchFile();
      this.initialized = true;
    }
  }

  async init() {
    await this.ready();
  }

  async loadFile() {
    try {
      const data = await readFile(this.filePath, 'utf-8');
      const newEvents = this.parseCompleteLines(data);

      // Check if file was truncated/replaced
      if (this.events.length > 0 && newEvents.length > 0) {
        const oldLastSeq = this.events[this.events.length - 1].seq;
        const newLastSeq = newEvents[newEvents.length - 1].seq;
        // If the new last seq is less than old last seq, file was truncated
        if (newLastSeq < oldLastSeq) {
          this.emit('reset');
        }
      }

      this.events = newEvents;
      if (newEvents.length > 0) {
        this.lastSeq = newEvents[newEvents.length - 1].seq;
      }

      const fileStats = await stat(this.filePath);
      this.fileSize = fileStats.size;
      this.lastProcessedOffset = this.fileSize;
    } catch (err) {
      if (err.code !== 'ENOENT') {
        console.error('Error reading events file:', err);
      }
      this.events = [];
      this.lastSeq = 0;
    }
  }

  parseCompleteLines(data) {
    const newEvents = [];
    const seenSeqs = new Set();
    const lines = data.split('\n');

    // If the file ends with a newline, the last element will be an empty string (complete lines)
    // If the file doesn't end with a newline, the last element is a partial line (skip it)
    let linesToProcess;
    if (data.endsWith('\n')) {
      // All lines are complete (last empty element is after the newline)
      linesToProcess = lines.slice(0, -1);
    } else {
      // Last line is incomplete, exclude it
      linesToProcess = lines.slice(0, -1);
    }

    for (const line of linesToProcess) {
      if (!line.trim()) continue;
      try {
        const event = JSON.parse(line);
        if (event && typeof event.seq === 'number' && !seenSeqs.has(event.seq)) {
          newEvents.push(event);
          seenSeqs.add(event.seq);
        }
      } catch {
        // Skip malformed lines
      }
    }

    return newEvents;
  }

  watchFile() {
    // Only start watching if file exists
    if (!existsSync(this.filePath)) {
      return;
    }
    
    this.watchHandle = watch(this.filePath, { persistent: true }, async (eventType) => {
      if (eventType === 'change') {
        await this.checkForNewEvents();
      }
    });
    
    // Handle watch errors
    this.watchHandle.on('error', (err) => {
      if (err.code === 'ENOENT') {
        // File was deleted, clear state
        this.events = [];
        this.lastSeq = 0;
        this.emit('reset');
      } else {
        console.error('Watch error:', err);
      }
    });
  }

  async checkForNewEvents() {
    if (this.reading) return;
    this.reading = true;

    try {
      const data = await readFile(this.filePath, 'utf-8');
      const newEvents = this.parseCompleteLines(data);

      // Check for truncation: if the last seq in new events is less than our last known seq,
      // the file was truncated/replaced
      if (this.events.length > 0 && newEvents.length > 0) {
        const oldLastSeq = this.events[this.events.length - 1].seq;
        const newLastSeq = newEvents[newEvents.length - 1].seq;
        if (newLastSeq < oldLastSeq) {
          // File was truncated/replaced - clear and reset
          this.events = [];
          this.lastSeq = 0;
          this.emit('reset');
          // Don't process events further after reset
          this.reading = false;
          return;
        }
      } else if (this.events.length > 0 && newEvents.length === 0) {
        // File was emptied
        this.events = [];
        this.lastSeq = 0;
        this.emit('reset');
        this.reading = false;
        return;
      }

      // Find new events: those with seq greater than our last known seq
      for (const event of newEvents) {
        if (event.seq > this.lastSeq) {
          this.events.push(event);
          this.lastSeq = event.seq;
          this.emit('event', event);
        }
      }

      const fileStats = await stat(this.filePath);
      this.fileSize = fileStats.size;
    } catch (err) {
      if (err.code === 'ENOENT') {
        // File was deleted
        this.events = [];
        this.lastSeq = 0;
        this.emit('reset');
      } else {
        console.error('Error checking for new events:', err);
      }
    } finally {
      this.reading = false;
    }
  }

  async getSnapshot() {
    return {
      events: this.events,
      lastSeq: this.lastSeq,
    };
  }

  getEventsSince(lastSeq) {
    return this.events.filter(e => e.seq > lastSeq);
  }

  shutdown() {
    if (this.watchHandle) {
      this.watchHandle.close();
    }
  }
}
