import test, { after, before } from "node:test";
import assert from "node:assert/strict";
import { handleRequest } from "../functions/[[path]].js";

const query = Uint8Array.from([
  0xaa, 0xbb, 0x01, 0x00, 0x00, 0x01, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00,
  0x03, 0x77, 0x77, 0x77, 0x07, 0x65, 0x78, 0x61, 0x6d, 0x70, 0x6c, 0x65,
  0x03, 0x63, 0x6f, 0x6d, 0x00, 0x00, 0x01, 0x00, 0x01,
]);

const upstreamResponse = new Uint8Array(query);
upstreamResponse[2] |= 0x80;
upstreamResponse[3] |= 0x80;

const assets = {
  async fetch(request) {
    const pathname = new URL(request.url).pathname;
    if (pathname === "/") return new Response("landing page", { status: 200 });
    if (pathname.startsWith("/rules/")) return new Response("", { status: 200 });
    return new Response("Not Found", { status: 404 });
  },
};

const env = { ASSETS: assets };
const ctx = { waitUntil(promise) { promise.catch(() => {}); } };
const originalFetch = globalThis.fetch;

before(() => {
  globalThis.fetch = async (input) => {
    const url = typeof input === "string" ? input : input.url;
    if (url.includes("cloudflare-gateway.com") || url.includes("quad9.net")) {
      return new Response(upstreamResponse, {
        status: 200,
        headers: { "content-type": "application/dns-message" },
      });
    }
    return originalFetch(input);
  };
});

after(() => {
  globalThis.fetch = originalFetch;
});

test("GET /dns-query accepts unpadded base64url and returns binary DNS", async () => {
  const dns = Buffer.from(query).toString("base64url");
  const response = await handleRequest(
    new Request(`https://example.test/dns-query?dns=${dns}`, { headers: { Accept: "application/dns-message" } }),
    env,
    ctx,
  );

  assert.equal(response.status, 200);
  assert.equal(response.headers.get("content-type"), "application/dns-message");
  assert.deepEqual(new Uint8Array(await response.arrayBuffer()).slice(0, 2), query.slice(0, 2));
});

test("POST /dns-query accepts application/dns-message", async () => {
  const response = await handleRequest(
    new Request("https://example.test/dns-query", {
      method: "POST",
      headers: { "content-type": "application/dns-message" },
      body: query,
    }),
    env,
    ctx,
  );

  assert.equal(response.status, 200);
  assert.equal(response.headers.get("content-type"), "application/dns-message");
});

test("DoH validation returns the required client error statuses", async () => {
  assert.equal((await handleRequest(new Request("https://example.test/dns-query"), env, ctx)).status, 400);
  assert.equal((await handleRequest(new Request("https://example.test/dns-query?dns=not!base64"), env, ctx)).status, 400);
  assert.equal((await handleRequest(new Request("https://example.test/dns-query", {
    method: "POST",
    headers: { "content-type": "text/plain" },
    body: query,
  }), env, ctx)).status, 415);
  assert.equal((await handleRequest(new Request("https://example.test/dns-query", {
    method: "PUT",
    body: query,
  }), env, ctx)).status, 405);
  assert.equal((await handleRequest(new Request("https://example.test/dns-query", {
    method: "POST",
    headers: { "content-type": "application/dns-message" },
    body: new Uint8Array(65536),
  }), env, ctx)).status, 413);
});

test("static landing page and auxiliary routes remain available", async () => {
  const landing = await handleRequest(new Request("https://example.test/"), env, ctx);
  assert.equal(landing.status, 200);
  assert.equal((await handleRequest(new Request("https://example.test/debug"), env, ctx)).status, 200);
  assert.equal((await handleRequest(new Request("https://example.test/apple"), env, ctx)).status, 200);
});
