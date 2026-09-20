import test from 'node:test';
import assert from 'node:assert/strict';
import { isPrivateIp, isPrivateHostname, assertPublicHttpUrl, isStrictUrlGuard } from '../utils/url-guard.js';

function withEnv(env, fn) {
  const saved = {};
  for (const [key, value] of Object.entries(env)) {
    saved[key] = process.env[key];
    if (value === undefined) delete process.env[key];
    else process.env[key] = value;
  }
  try {
    fn();
  } finally {
    for (const [key, value] of Object.entries(saved)) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
  }
}

test('private IPv4 ranges are classified as private', () => {
  for (const ip of [
    '127.0.0.1', '10.0.0.5', '172.16.0.1', '172.31.255.255', '192.168.1.1',
    '169.254.169.254', '0.0.0.0', '100.64.0.1', '224.0.0.1',
  ]) {
    assert.ok(isPrivateIp(ip), `${ip} should be private`);
  }
});

test('public IPv4 addresses are classified as public', () => {
  for (const ip of ['8.8.8.8', '1.1.1.1', '172.32.0.1', '100.128.0.1', '9.9.9.9']) {
    assert.equal(isPrivateIp(ip), false, `${ip} should be public`);
  }
});

test('fake-ip proxy range 198.18.0.0/15 must stay public (Clash/sing-box TUN)', () => {
  // Clash/sing-box 的 fake-ip 模式把所有域名解析到 198.18.0.0/15，
  // 一旦分类为私网并在连接时拦截，代理环境下全部行情源都会失效
  for (const ip of ['198.18.0.1', '198.18.0.82', '198.19.255.255']) {
    assert.equal(isPrivateIp(ip), false, `${ip} should be public`);
  }
});

test('IPv6 loopback / ULA / link-local are private, mapped IPv4 is inspected', () => {
  assert.ok(isPrivateIp('::1'));
  assert.ok(isPrivateIp('::'));
  assert.ok(isPrivateIp('fc00::1'));
  assert.ok(isPrivateIp('fe80::1'));
  assert.ok(isPrivateIp('::ffff:127.0.0.1'));
  assert.ok(isPrivateIp('::ffff:192.168.1.1'));
  assert.equal(isPrivateIp('2606:4700::1111'), false);
});

test('localhost-style hostnames are classified private, domains defer to DNS-time check', () => {
  assert.ok(isPrivateHostname('localhost'));
  assert.ok(isPrivateHostname('foo.localhost'));
  assert.ok(isPrivateHostname('myhost.local'));
  assert.ok(isPrivateHostname('127.0.0.1'));
  assert.equal(isPrivateHostname('api.example.com'), false);
});

test('default mode never blocks: only format/protocol errors are rejected', () => {
  withEnv({ STRICT_URL_GUARD: undefined, ALLOW_PRIVATE_URLS: undefined }, () => {
    assert.equal(isStrictUrlGuard(), false);
    // 内网/本机地址是合法场景（本地 Ollama、内网自建源、localhost 网关）
    assert.equal(assertPublicHttpUrl('http://127.0.0.1:8080/price'), null);
    assert.equal(assertPublicHttpUrl('http://localhost:19000/proxy'), null);
    assert.equal(assertPublicHttpUrl('http://192.168.1.5/api'), null);
    assert.equal(assertPublicHttpUrl('https://api.example.com/v1?key=1'), null);
    // 格式问题仍然拒绝
    assert.ok(assertPublicHttpUrl('file:///etc/passwd'));
    assert.ok(assertPublicHttpUrl('not a url'));
    assert.ok(assertPublicHttpUrl(''));
  });
});

test('strict mode (STRICT_URL_GUARD=1) rejects private addresses', () => {
  withEnv({ STRICT_URL_GUARD: '1' }, () => {
    assert.equal(isStrictUrlGuard(), true);
    assert.ok(assertPublicHttpUrl('http://127.0.0.1/x'));
    assert.ok(assertPublicHttpUrl('http://localhost:19000/proxy'));
    assert.equal(assertPublicHttpUrl('https://api.example.com/v1'), null);
    assert.ok(assertPublicHttpUrl('file:///etc/passwd'));
  });
});

test('legacy ALLOW_PRIVATE_URLS=0 also enables strict mode', () => {
  withEnv({ STRICT_URL_GUARD: undefined, ALLOW_PRIVATE_URLS: '0' }, () => {
    assert.equal(isStrictUrlGuard(), true);
  });
});
