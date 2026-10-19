import test from 'node:test';
import assert from 'node:assert/strict';
import { isAuthorized } from '../cloud-core/worker.js';

test('isAuthorized is fail-closed and only accepts the exact bearer token', async () => {
  assert.equal(await isAuthorized('Bearer anything', undefined), false); // unset token must NOT open the API
  assert.equal(await isAuthorized('', ''), false);
  assert.equal(await isAuthorized('Bearer s3cret', 's3cret'), true);
  assert.equal(await isAuthorized('Bearer s3cre', 's3cret'), false);
  assert.equal(await isAuthorized(null, 's3cret'), false);
});
