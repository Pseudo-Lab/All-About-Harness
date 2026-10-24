export class EventStream {
  constructor(fileReader) {
    this.fileReader = fileReader;
    this.subscribers = [];
    this.nextId = 0;

    // Listen for new events
    this.fileReader.on('event', (event) => {
      this.broadcast(event);
    });

    // Listen for file reset
    this.fileReader.on('reset', () => {
      this.broadcastReset();
    });

    // Heartbeat timer for idle connections
    this.heartbeatTimer = setInterval(() => {
      this.sendHeartbeats();
    }, 15000);
  }

  async subscribe(res, lastId) {
    const subscriberId = this.nextId++;
    const subscriber = { res, lastId, closed: false };
    this.subscribers.push(subscriber);

    try {
      // Send reset signal if needed (for log replacement)
      // This is handled elsewhere, just replay history first

      // Replay events since lastId
      const snapshot = await this.fileReader.getSnapshot();
      
      // Ensure lastId is a number or undefined
      const normalizedLastId = lastId === undefined ? undefined : Number(lastId);
      
      const events = normalizedLastId === undefined
        ? snapshot.events
        : snapshot.events.filter(e => e.seq > normalizedLastId);

      for (const event of events) {
        if (!subscriber.closed) {
          this.sendEvent(res, event);
        }
      }
    } catch (err) {
      console.error('Error replaying events:', err);
    }

    // Return unsubscribe function
    return () => {
      subscriber.closed = true;
      const idx = this.subscribers.indexOf(subscriber);
      if (idx >= 0) {
        this.subscribers.splice(idx, 1);
      }
    };
  }

  sendEvent(res, event) {
    res.write(`id: ${event.seq}\n`);
    res.write(`event: ralph\n`);
    res.write(`data: ${JSON.stringify(event)}\n\n`);
  }

  broadcast(event) {
    for (const subscriber of this.subscribers) {
      if (!subscriber.closed) {
        try {
          this.sendEvent(subscriber.res, event);
        } catch (err) {
          subscriber.closed = true;
        }
      }
    }
  }

  broadcastReset() {
    // Get snapshot once and send to all subscribers
    this.fileReader.getSnapshot().then(snapshot => {
      for (const subscriber of this.subscribers) {
        if (!subscriber.closed) {
          try {
            subscriber.res.write(`event: reset\n\n`);
            // After reset, replay all current events
            for (const event of snapshot.events) {
              this.sendEvent(subscriber.res, event);
            }
          } catch (err) {
            subscriber.closed = true;
          }
        }
      }
    }).catch(err => {
      console.error('Error replaying after reset:', err);
    });
  }

  sendHeartbeats() {
    for (const subscriber of this.subscribers) {
      if (!subscriber.closed) {
        try {
          subscriber.res.write(`: heartbeat\n\n`);
        } catch (err) {
          subscriber.closed = true;
        }
      }
    }
  }

  shutdown() {
    clearInterval(this.heartbeatTimer);
    for (const subscriber of this.subscribers) {
      subscriber.closed = true;
      try {
        subscriber.res.end();
      } catch (err) {
        // Ignore
      }
    }
  }
}
