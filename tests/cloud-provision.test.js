import test from 'node:test';
import assert from 'node:assert/strict';
import {
  extractOAuthUrl,
  extractD1DatabaseId,
  findD1InList,
  extractWorkersDevUrl,
  needsWorkersDevSubdomain,
  renderGeneratedConfig,
  mergeCloudConfig
} from '../scripts/cloud-provision.mjs';

const ID = '1b2c3d4e-5f60-4718-9a0b-c1d2e3f40516';

test('cloud-provision parses wrangler output (login URL, D1 id old+new format, deploy URL)', () => {
  assert.equal(
    extractOAuthUrl('Visit this link to authenticate: https://dash.cloudflare.com/oauth2/auth?response_type=code&client_id=x\nWaiting'),
    'https://dash.cloudflare.com/oauth2/auth?response_type=code&client_id=x'
  );
  assert.equal(extractOAuthUrl('nothing here'), null);
  assert.equal(extractD1DatabaseId(`[[d1_databases]]\ndatabase_id = "${ID}"`), ID);
  assert.equal(extractD1DatabaseId(`{ "database_id": "${ID}" }`), ID);
  assert.equal(findD1InList(JSON.stringify([{ name: 'other', uuid: 'x' }, { name: 'botautotask-db', uuid: ID }])), ID);
  assert.equal(findD1InList('not json'), null);
  assert.equal(
    extractWorkersDevUrl('Deployed botautotask-cloud-core triggers\n  https://botautotask-cloud-core.huong.workers.dev\n'),
    'https://botautotask-cloud-core.huong.workers.dev'
  );
  assert.equal(needsWorkersDevSubdomain('You need to register a workers.dev subdomain before publishing'), true);
  assert.equal(needsWorkersDevSubdomain('Uploaded fine'), false);
});

test('cloud-provision renders generated wrangler config and merges user config without losing keys', () => {
  const toml = 'name = "x"\n[[d1_databases]]\ndatabase_id = "REPLACE_WITH_YOUR_D1_DATABASE_ID"\n';
  assert.match(renderGeneratedConfig(toml, ID), new RegExp(`database_id = "${ID}"`));
  assert.throws(() => renderGeneratedConfig(toml, 'evil"; rm -rf'), /Invalid D1/);
  const merged = mergeCloudConfig({ priorityModels: ['a'], cloud: { apiToken: 't' } }, { url: 'https://u' });
  assert.deepEqual(merged, { priorityModels: ['a'], cloud: { apiToken: 't', url: 'https://u' } });
});
