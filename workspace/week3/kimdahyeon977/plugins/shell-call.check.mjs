// node plugins/shell-call.check.mjs — the group default is a ceiling the session can only narrow.
import assert from 'node:assert/strict'
import { capMode } from './shell-call.mjs'

assert.equal(capMode('workspace-write', 'read-only'), 'read-only')            // Task 5: session widens verify → capped
assert.equal(capMode('read-only', 'workspace-write'), 'read-only')            // session narrows fix → kept
assert.equal(capMode('workspace-write', 'workspace-write'), 'workspace-write')
assert.equal(capMode('danger-full-access', 'workspace-write'), 'workspace-write')
assert.equal(capMode('bogus', 'read-only'), 'read-only')                      // unknown mode fails closed
console.log('capMode ok')
