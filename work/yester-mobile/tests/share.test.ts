import test from 'node:test';
import assert from 'node:assert/strict';
import { feedLink, openSharedFeed } from '../src/feedLink.ts';

test('shared addresses survive web and app handoffs intact', () => {
  for (const base of ['https://pixelclub.yestersites.com/diary.html', 'https://example.org/fan/page']) {
    const url = base + '?entry=' + 'pixel'.repeat(30) + '&song=a%20b#studio';
    const shared = feedLink(url);
    assert.equal(new URL(shared).searchParams.get('url'), url);
    assert.equal(openSharedFeed(shared), shared);
    assert.equal(openSharedFeed('yester://browse?url=' + encodeURIComponent(url)), shared);
  }
});

test('unsupported destinations never become shared app pages', () => {
  for (const url of ['file:///etc/hosts', 'https://user:password@example.org/']) {
    assert.equal(openSharedFeed('https://yestersites.com/browse/?url='+encodeURIComponent(url)), null);
  }
  assert.equal(openSharedFeed('https://example.org/browse/?url=https://yestersites.com'),null);
});
