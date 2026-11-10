// The Docker image is built by running site.sh on what .dockerignore lets through, so everything site.sh copies must
// get through. (A file excluded there fails the build with "cp: can't stat".)
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

test('everything site.sh copies is in the Docker build context', () => {
  const copied = /^cp -r (.+) "\$dest"\/$/m.exec(fs.readFileSync('site.sh', 'utf8'))[1].split(/\s+/);
  const ignored = fs.readFileSync('.dockerignore', 'utf8').split('\n').map(l => l.trim()).filter(l => l && !l.startsWith('#'));
  for (const f of copied) {
    assert.ok(fs.existsSync(f), `site.sh copies ${f}, which isn't in the repo`);
    assert.ok(!ignored.includes(f) && !ignored.includes(f + '/'), `.dockerignore leaves out ${f}, which site.sh copies`);
  }
});
