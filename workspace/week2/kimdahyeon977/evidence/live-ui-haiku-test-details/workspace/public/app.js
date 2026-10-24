class Dashboard {
  constructor() {
    this.events = [];
    this.lastSeq = 0;
    this.state = {
      run: null,
      rounds: new Map(),
      children: new Map(),
      acceptanceTests: new Map(),
    };
    this.eventSource = null;
    this.showFailuresOnly = false;
    this.selectedRound = null;

    this.init();
  }

  async init() {
    // Load initial snapshot
    try {
      const response = await fetch('/api/snapshot');
      if (response.ok) {
        const data = await response.json();
        this.events = data.events || [];
        this.lastSeq = data.lastSeq || 0;
        this.processEvents(this.events);
        this.render();
      }
    } catch (err) {
      console.error('Failed to load snapshot:', err);
    }

    // Setup event listeners
    document.getElementById('filter-failures').addEventListener('change', (e) => {
      this.showFailuresOnly = e.target.checked;
      this.renderTimeline();
    });

    document.getElementById('round-selector').addEventListener('change', (e) => {
      this.selectedRound = e.target.value === '' ? null : Number(e.target.value);
      this.renderRounds();
      this.renderTimeline();
    });

    // Start SSE subscription
    this.subscribeToEvents();
  }

  subscribeToEvents() {
    const headers = {};
    if (this.lastSeq > 0) {
      headers['Last-Event-ID'] = String(this.lastSeq);
    }

    this.eventSource = new EventSource('/api/events');

    this.eventSource.addEventListener('ralph', (e) => {
      try {
        const event = JSON.parse(e.data);
        this.handleEvent(event);
      } catch (err) {
        console.error('Failed to parse event:', err);
      }
    });

    this.eventSource.addEventListener('reset', () => {
      console.log('Log reset detected, reloading...');
      this.events = [];
      this.lastSeq = 0;
      this.state = {
        run: null,
        rounds: new Map(),
        children: new Map(),
        acceptanceTests: new Map(),
      };
      this.render();
    });

    this.eventSource.addEventListener('open', () => {
      this.updateConnectionStatus(true);
    });

    this.eventSource.addEventListener('error', () => {
      this.updateConnectionStatus(false);
    });

    this.eventSource.onerror = () => {
      this.updateConnectionStatus(false);
    };
  }

  handleEvent(event) {
    if (event.seq <= this.lastSeq) {
      // Duplicate event
      return;
    }

    this.events.push(event);
    this.lastSeq = event.seq;
    this.processEvent(event);
    this.render();
  }

  processEvents(events) {
    for (const event of events) {
      this.processEvent(event);
    }
  }

  processEvent(event) {
    switch (event.event) {
      case 'run/start':
        this.state.run = { status: 'running', startTime: event.at };
        break;

      case 'run/end':
        if (this.state.run) {
          this.state.run.status = event.status;
          this.state.run.endTime = event.at;
        }
        break;

      case 'run/error':
        if (this.state.run) {
          this.state.run.error = event.status;
        }
        break;

      case 'round/start':
        this.state.rounds.set(event.round, {
          round: event.round,
          handoff: event.handoff,
          status: 'running',
          startTime: event.at,
          children: [],
          acceptance: null,
        });
        break;

      case 'round/end':
        const roundData = this.state.rounds.get(event.round);
        if (roundData) {
          roundData.status = event.result;
          roundData.endTime = event.at;
        }
        break;

      case 'child/start':
        const startChildKey = `${event.round}:${event.role}:${event.childId}`;
        this.state.children.set(startChildKey, {
          round: event.round,
          role: event.role,
          childId: event.childId,
          status: 'running',
          startTime: event.at,
          summary: '',
        });

        const roundStart = this.state.rounds.get(event.round);
        if (roundStart && !roundStart.children.includes(startChildKey)) {
          roundStart.children.push(startChildKey);
        }
        break;

      case 'child/end':
        const endChildKey = `${event.round}:${event.role}:${event.childId}`;
        const childData = this.state.children.get(endChildKey);
        if (childData) {
          childData.status = event.status;
          childData.summary = event.summary;
          childData.endTime = event.at;
        }
        break;

      case 'acceptance/start':
        const roundAcc = this.state.rounds.get(event.round);
        if (roundAcc) {
          roundAcc.acceptance = {
            round: event.round,
            status: 'running',
            startTime: event.at,
          };
        }
        break;

      case 'acceptance/end':
        const roundAccEnd = this.state.rounds.get(event.round);
        if (roundAccEnd) {
          roundAccEnd.acceptance = {
            round: event.round,
            status: 'completed',
            kind: event.kind,
            exitCode: event.exitCode,
            testsRun: event.testsRun,
            passed: event.passed,
            failed: event.failed,
            summary: event.summary,
            endTime: event.at,
          };
        }
        break;
    }
  }

  updateConnectionStatus(connected) {
    const status = document.getElementById('connection-status');
    if (connected) {
      status.classList.remove('disconnected');
      status.classList.add('connected');
      status.querySelector('.status-text').textContent = 'Connected';
    } else {
      status.classList.remove('connected');
      status.classList.add('disconnected');
      status.querySelector('.status-text').textContent = 'Disconnected';
    }
  }

  render() {
    this.renderRunStatus();
    this.renderRounds();
    this.renderTimeline();
  }

  renderRunStatus() {
    const container = document.getElementById('run-status');

    if (!this.state.run) {
      container.className = 'run-status empty';
      container.innerHTML = '<p>Waiting for events...</p>';
      return;
    }

    const run = this.state.run;
    let statusHtml = '';

    if (run.error) {
      statusHtml = `<div class="run-error"><strong>Error:</strong> ${this.escape(run.error)}</div>`;
    } else {
      statusHtml = `<div class="run-info">
        <strong>Status:</strong> ${this.escape(run.status)}
        ${run.startTime ? `<br><strong>Started:</strong> ${this.escape(run.startTime)}` : ''}
        ${run.endTime ? `<br><strong>Ended:</strong> ${this.escape(run.endTime)}` : ''}
      </div>`;
    }

    container.className = 'run-status';
    container.innerHTML = statusHtml;
  }

  renderRounds() {
    const container = document.getElementById('rounds-container');
    const selector = document.getElementById('round-selector');
    const rounds = Array.from(this.state.rounds.values()).sort((a, b) => a.round - b.round);

    // Update selector options
    const currentValue = selector.value;
    selector.innerHTML = '<option value="">All Rounds</option>';
    for (const round of rounds) {
      const option = document.createElement('option');
      option.value = round.round;
      option.textContent = `Round ${round.round}`;
      selector.appendChild(option);
    }
    selector.value = currentValue;

    if (rounds.length === 0) {
      container.innerHTML = '';
      return;
    }

    // Filter rounds based on selection
    let displayRounds = rounds;
    if (this.selectedRound !== null) {
      displayRounds = rounds.filter(r => r.round === this.selectedRound);
    }

    container.innerHTML = displayRounds.map(round => this.renderRound(round)).join('');
  }

  renderRound(round) {
    // Get impl and test children
    const implChild = round.children
      .map(key => this.state.children.get(key))
      .find(c => c && c.role === 'implementation');
    const testChild = round.children
      .map(key => this.state.children.get(key))
      .find(c => c && c.role === 'test');
    
    // Get other children (if any)
    const otherChildren = round.children
      .map(key => this.state.children.get(key))
      .filter(c => c && c.role !== 'implementation' && c.role !== 'test');

    // Build stage flow visualization
    const stageFlow = this.renderStageFlow(implChild, testChild, round.acceptance);

    const handoffHtml = round.handoff
      ? `<div class="handoff">${this.escape(round.handoff)}</div>`
      : '';

    // Use safe CSS class based on status value
    const resultClass = this.getStatusClass(round.status);

    const otherChildrenHtml = otherChildren
      .map(child => this.renderChild(child))
      .join('');

    return `
      <div class="round-card">
        <div class="round-header">
          <div class="round-number">Round ${round.round}</div>
          <div class="round-result ${resultClass}">${this.escape(round.status || 'pending')}</div>
        </div>
        ${handoffHtml}
        ${stageFlow}
        ${otherChildrenHtml}
      </div>
    `;
  }

  renderStageFlow(implChild, testChild, acceptance) {
    const implStatus = this.getStageStatus(implChild);
    const testStatus = this.getStageStatus(testChild);
    const acceptanceStatus = this.getAcceptanceStageStatus(acceptance);
    const acceptanceStatusClass = this.getStatusClass(acceptanceStatus);

    return `
      <div class="stage-flow">
        <div class="stage-item">
          <div class="stage-label">Implementation</div>
          ${this.renderStageCard(implChild, implStatus)}
        </div>
        <div class="stage-arrow">→</div>
        <div class="stage-item">
          <div class="stage-label">Test</div>
          ${this.renderStageCard(testChild, testStatus)}
        </div>
        <div class="stage-arrow">→</div>
        <div class="stage-item">
          <div class="stage-label">Host Acceptance</div>
          ${this.renderAcceptanceStageCard(acceptance, acceptanceStatus, acceptanceStatusClass)}
        </div>
      </div>
    `;
  }

  getStageStatus(child) {
    if (!child) return 'pending';
    return child.status || 'running';
  }

  getAcceptanceStageStatus(acceptance) {
    if (!acceptance) return 'pending';
    if (acceptance.status === 'running') return 'running';
    if (acceptance.failed && acceptance.failed > 0) return 'fail';
    return 'pass';
  }

  renderStageCard(child, status) {
    if (!child) {
      return `<div class="stage-card pending">
        <div class="stage-status-dot">●</div>
        <div class="stage-info">Not started</div>
      </div>`;
    }

    const statusClass = this.getStatusClass(status);
    const statusText = this.escape(status);
    const summaryText = child.summary ? this.renderStageSummary(child.summary) : '';

    return `<div class="stage-card ${statusClass}">
      <div class="stage-status-dot">●</div>
      <div class="stage-info">
        <div class="stage-id">${this.escape(child.childId)}</div>
        <div class="stage-status">${statusText}</div>
        ${summaryText}
      </div>
    </div>`;
  }

  renderStageSummary(summary) {
    // Treat summaries longer than 200 characters as "long" and make them expandable
    if (summary.length > 200) {
      const escaped = this.escape(summary);
      // Show first 100 chars or until first newline as preview
      const lines = summary.split('\n');
      const previewText = lines[0].length > 100 ? summary.substring(0, 100) + '...' : lines[0];
      const escapedPreview = this.escape(previewText);
      return `<details class="long-report-disclosure">
        <summary class="long-report-summary">${escapedPreview}</summary>
        <div class="long-report-content">${escaped}</div>
      </details>`;
    }
    return `<div class="stage-summary">${this.escape(summary)}</div>`;
  }

  renderAcceptanceStageCard(acceptance, status, statusClass) {
    if (!acceptance) {
      return `<div class="stage-card pending">
        <div class="stage-status-dot">●</div>
        <div class="stage-info">Not started</div>
      </div>`;
    }

    const safeStatusClass = this.getStatusClass(status);
    const statusText = this.escape(status);

    if (acceptance.testsRun) {
      const testCount = `${acceptance.passed}/${acceptance.testsRun}`;
      const hasTestDetails = acceptance.summary && typeof acceptance.summary === 'string' && acceptance.summary.length > 0;
      
      if (hasTestDetails) {
        // Create a details control with test information
        const tapContent = this.escape(acceptance.summary);
        return `<details class="acceptance-test-disclosure ${safeStatusClass}">
          <summary class="acceptance-test-summary">
            <span class="stage-status-dot">●</span>
            <span class="acceptance-test-info">
              <span class="stage-status">${statusText}</span>
              <span class="stage-tests">${testCount}</span>
            </span>
          </summary>
          <div class="acceptance-test-content">
            <pre class="tap-output">${tapContent}</pre>
          </div>
        </details>`;
      }

      return `<div class="stage-card ${safeStatusClass}">
        <div class="stage-status-dot">●</div>
        <div class="stage-info">
          <div class="stage-status">${statusText}</div>
          <div class="stage-tests">${testCount}</div>
        </div>
      </div>`;
    }

    return `<div class="stage-card ${safeStatusClass}">
      <div class="stage-status-dot">●</div>
      <div class="stage-info">
        <div class="stage-status">${statusText}</div>
      </div>
    </div>`;
  }

  renderChild(child) {
    // Use safe CSS class based on status value, never use untrusted data directly in class
    const statusClass = this.getStatusClass(child.status);
    const summaryHtml = child.summary
      ? `<div class="child-summary">${this.escape(child.summary)}</div>`
      : '';

    return `
      <div class="child-card">
        <div class="child-header">
          <div>
            <div class="child-role">${this.escape(child.role)}</div>
            <div class="child-id">${this.escape(child.childId)}</div>
          </div>
          <div class="child-status ${statusClass}">${this.escape(child.status || 'running')}</div>
        </div>
        ${summaryHtml}
      </div>
    `;
  }

  renderAcceptance(acceptance) {
    if (!acceptance.testsRun) {
      return `
        <div class="acceptance-card">
          <div class="acceptance-header">Host Tests</div>
          <div style="font-size: 0.9rem; color: #666;">Running...</div>
        </div>
      `;
    }

    const failedClass = acceptance.failed > 0 ? 'failed' : 'passed';

    return `
      <div class="acceptance-card">
        <div class="acceptance-header">Host Tests</div>
        <div class="acceptance-stats">
          <div class="stat">
            <span class="stat-label">Tests:</span>
            <span class="stat-value">${acceptance.testsRun}</span>
          </div>
          <div class="stat">
            <span class="stat-label">Passed:</span>
            <span class="stat-value passed">${acceptance.passed}</span>
          </div>
          <div class="stat">
            <span class="stat-label">Failed:</span>
            <span class="stat-value ${failedClass}">${acceptance.failed}</span>
          </div>
        </div>
        ${acceptance.summary ? `<div class="acceptance-summary">${this.escape(acceptance.summary)}</div>` : ''}
      </div>
    `;
  }

  renderTimeline() {
    const container = document.getElementById('timeline');
    let events = this.events;

    // Filter by selected round if one is chosen
    if (this.selectedRound !== null) {
      events = events.filter(e => {
        // Include events that belong to this round
        return e.round === this.selectedRound ||
               (e.event === 'run/start' || e.event === 'run/end' || e.event === 'run/error');
      });
    }

    if (this.showFailuresOnly) {
      events = events.filter(e => {
        return e.event === 'child/end' && e.status === 'fail'
          || e.event === 'acceptance/end' && e.failed > 0
          || e.event === 'run/error';
      });
    }

    if (events.length === 0) {
      container.innerHTML = this.showFailuresOnly
        ? '<div style="color: #999; font-style: italic;">No failures to display</div>'
        : '<div style="color: #999; font-style: italic;">No events yet</div>';
      return;
    }

    container.innerHTML = events.map(event => this.renderTimelineEvent(event)).join('');
  }

  renderTimelineEvent(event) {
    let detail = '';
    // Map event type to safe class name using validation
    const className = this.getEventTypeClass(event.event);

    switch (event.event) {
      case 'run/start':
        detail = 'Run started';
        break;
      case 'run/end':
        detail = `Run ended: ${this.escape(event.status)}`;
        break;
      case 'run/error':
        detail = `Run error: ${this.escape(event.status)}`;
        break;
      case 'round/start':
        detail = `Round ${event.round} started`;
        break;
      case 'round/end':
        detail = `Round ${event.round} ended: ${this.escape(event.result)}`;
        break;
      case 'child/start':
        detail = `${this.escape(event.role)} child started: ${this.escape(event.childId)}`;
        break;
      case 'child/end':
        detail = `${this.escape(event.role)} child ended: ${this.escape(event.status)} - ${this.escape(event.summary)}`;
        break;
      case 'acceptance/start':
        detail = `Host tests started for round ${event.round}`;
        break;
      case 'acceptance/end':
        detail = `Host tests ended: ${event.passed}/${event.testsRun} passed`;
        break;
      default:
        detail = JSON.stringify(event);
    }

    return `
      <div class="timeline-event ${className}">
        <div class="timeline-event-time">${this.escape(event.at)}</div>
        <div class="timeline-event-type">${this.escape(event.event)}</div>
        <div class="timeline-event-detail">${this.escape(detail)}</div>
      </div>
    `;
  }

  escape(str) {
    if (typeof str !== 'string') return String(str);
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
  }

  // Map status values to safe CSS class names. Only these predefined values are allowed as classes.
  getStatusClass(status) {
    const safeClasses = {
      'running': 'running',
      'ready': 'ready',
      'pass': 'pass',
      'fail': 'fail',
      'continue': 'continue',
      'pending': 'pending',
      'completed': 'completed',
      'blocked': 'blocked',
      'cancelled': 'cancelled',
      'complete': 'complete',
      'incomplete': 'incomplete',
    };
    // Return the safe class or a fallback neutral class, never the untrusted input
    return safeClasses[status] || 'unknown';
  }

  // Map event type strings to safe CSS class names
  getEventTypeClass(eventType) {
    const eventMap = {
      'run/start': 'event-run-start',
      'run/end': 'event-run-end',
      'run/error': 'event-run-error',
      'round/start': 'event-round-start',
      'round/end': 'event-round-end',
      'child/start': 'event-child-start',
      'child/end': 'event-child-end',
      'acceptance/start': 'event-acceptance-start',
      'acceptance/end': 'event-acceptance-end',
    };
    // Return the mapped class or a safe default, never the untrusted input
    return eventMap[eventType] || 'event-unknown';
  }
}

// Initialize dashboard when DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => {
    new Dashboard();
  });
} else {
  new Dashboard();
}
