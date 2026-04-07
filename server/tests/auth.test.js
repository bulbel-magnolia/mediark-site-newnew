import assert from "node:assert/strict";
import test from "node:test";

import { apiRequest, createTestContext, loginAs } from "./test-helpers.js";

test("auth endpoints support login, me and logout", async (t) => {
  const ctx = await createTestContext();
  t.after(() => ctx.close());

  const badLogin = await apiRequest(ctx.baseUrl, "/api/auth/login", {
    method: "POST",
    body: { username: "admin", password: "wrong-password" }
  });
  assert.equal(badLogin.response.status, 401);
  assert.match(badLogin.payload.error, /invalid/i);

  const login = await loginAs(ctx.baseUrl, "admin", "admin123");
  assert.equal(login.payload.user.role, "admin");

  const me = await apiRequest(ctx.baseUrl, "/api/auth/me", {
    cookie: login.cookie
  });
  assert.equal(me.response.status, 200);
  assert.equal(me.payload.user.username, "admin");

  const logout = await apiRequest(ctx.baseUrl, "/api/auth/logout", {
    method: "POST",
    cookie: login.cookie
  });
  assert.equal(logout.response.status, 200);

  const afterLogout = await apiRequest(ctx.baseUrl, "/api/auth/me", {
    cookie: login.cookie
  });
  assert.equal(afterLogout.response.status, 401);
});
