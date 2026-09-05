import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";
import vm from "node:vm";

const source = fs.readFileSync(new URL("../src/background.js", import.meta.url), "utf8");
const link = "https://example.invalid/selected.torrent";
const response = (status) => ({ ok: status >= 200 && status < 300, status });

function createHarness(options = {}) {
  const state = options.state ?? {};
  const events = {};
  const calls = { auth: 0, validation: 0, transfers: [], notifications: [], tabs: [] };
  const event = (name) => ({
    addListener: (listener) => {
      events[name] = listener;
    },
  });
  const storage = {
    get: async (key) => ({ [key]: structuredClone(state[key]) }),
    set: async (values) => {
      if (values.token && options.beforeTokenWrite) await options.beforeTokenWrite();
      Object.assign(state, structuredClone(values));
    },
    remove: async (key) => {
      delete state[key];
    },
  };
  const browser = {
    runtime: {
      onInstalled: event("installed"),
      onStartup: event("startup"),
      getURL: (path) => path,
    },
    contextMenus: { onClicked: event("menu"), create: (_item, callback) => callback() },
    action: { onClicked: event("toolbar") },
    notifications: {
      onClicked: event("notification"),
      create: async (id, details) => {
        calls.notifications.push({ id, ...details });
      },
      clear: async () => {},
    },
    tabs: {
      create: async (details) => {
        calls.tabs.push(details);
      },
    },
    i18n: { getMessage: (key) => key },
    storage: { local: storage },
    identity: {
      getRedirectURL: () => "https://extension.invalid/callback",
      launchWebAuthFlow: async () => {
        calls.auth += 1;
        if (options.auth) return options.auth();
        return "https://extension.invalid/callback#access_token=new-token&token_type=bearer";
      },
    },
  };
  const context = vm.createContext({
    browser: options.chrome ? undefined : browser,
    chrome: options.chrome ? browser : undefined,
    console: { log() {}, error() {} },
    URL,
    URLSearchParams,
    fetch: async (url, request) => {
      if (url.endsWith("/oauth2/validate")) {
        calls.validation += 1;
        return options.validate ? options.validate() : response(200);
      }
      assert.ok(url.endsWith("/transfers/add"));
      const transfer = { ...JSON.parse(request.body), token: request.headers.Authorization };
      calls.transfers.push(transfer);
      if (options.transfer) return options.transfer(transfer, state);
      return response(200);
    },
  });
  vm.runInContext(source, context);
  return {
    state,
    calls,
    click: async (url = link) => {
      await events.menu({ menuItemId: "download-link", linkUrl: url }, {});
      await new Promise(setImmediate);
    },
    startup: async () => {
      await events.startup();
      await new Promise(setImmediate);
    },
    notification: async (id) => {
      await events.notification(id);
      await new Promise(setImmediate);
    },
  };
}

for (const chrome of [false, true]) {
  test(`resumes the exact selected link after durable authentication (${chrome ? "Chrome" : "Firefox"})`, async () => {
    const app = createHarness({
      chrome,
      transfer: (_request, state) => {
        assert.equal(state.token, "new-token");
        assert.equal(state.pendingTransfer.phase, "sending");
        return response(200);
      },
    });
    await app.click();
    assert.deepEqual(app.calls.transfers, [{ url: link, token: "token new-token" }]);
    assert.equal(app.calls.auth, 1);
    assert.equal(app.state.pendingTransfer, undefined);
  });
}

test("does not send until token storage completes", async () => {
  let release;
  const gate = new Promise((resolve) => {
    release = resolve;
  });
  const app = createHarness({ beforeTokenWrite: () => gate });
  const result = app.click();
  await new Promise(setImmediate);
  assert.equal(app.calls.transfers.length, 0);
  release();
  await result;
  assert.equal(app.calls.transfers.length, 1);
});

test("a second click cannot overwrite or replay the action being authenticated", async () => {
  let finishAuth;
  const auth = new Promise((resolve) => {
    finishAuth = resolve;
  });
  const app = createHarness({ auth: () => auth });
  const first = app.click();
  await new Promise(setImmediate);
  const second = app.click("https://example.invalid/other.torrent");
  finishAuth("https://extension.invalid/callback#access_token=new-token");
  await Promise.all([first, second]);
  assert.deepEqual(
    app.calls.transfers.map((transfer) => transfer.url),
    [link],
  );
  assert.equal(app.calls.auth, 1);
  assert.ok(app.calls.notifications.some((notice) => notice.title === "pendingTransferTitle"));
});

test("a rejected stored token authenticates once and retries only the rejected request", async () => {
  const app = createHarness({
    state: { token: "expired" },
    transfer: (request) => response(request.token === "token expired" ? 401 : 200),
  });
  await app.click();
  assert.deepEqual(
    app.calls.transfers.map((request) => request.token),
    ["token expired", "token new-token"],
  );
  assert.equal(app.calls.auth, 1);
  assert.equal(app.state.pendingTransfer, undefined);
});

test("persistent token rejection ends authentication and clears the saved action", async () => {
  const app = createHarness({ state: { token: "expired" }, transfer: () => response(401) });
  await app.click();
  assert.equal(app.calls.auth, 1);
  assert.equal(app.calls.transfers.length, 2);
  assert.equal(app.state.token, undefined);
  assert.equal(app.state.pendingTransfer, undefined);
});

for (const unavailable of [
  () => response(503),
  () => {
    throw new Error("offline");
  },
]) {
  test("startup validation outages retain credentials without opening authentication", async () => {
    const app = createHarness({
      state: { token: "existing" },
      validate: unavailable,
      auth: () => {
        throw new Error("fixture stops unexpected sign-in");
      },
    });
    await app.startup();
    assert.equal(app.calls.validation, 1);
    assert.equal(app.calls.auth, 0);
    assert.equal(app.state.token, "existing");
  });
  test("validation failure after authentication does not recursively sign in or send", async () => {
    let attempts = 0;
    const app = createHarness({
      validate: unavailable,
      auth: () => {
        if (++attempts > 1) throw new Error("fixture bounds recursive sign-in");
        return "https://extension.invalid/callback#access_token=new-token";
      },
    });
    await app.click();
    assert.equal(app.calls.auth, 1);
    assert.equal(app.calls.validation, 1);
    assert.equal(app.calls.transfers.length, 0);
    assert.equal(app.state.pendingTransfer.link, link);
  });
}

test("cancelling authentication clears the saved link", async () => {
  const app = createHarness({
    auth: () => {
      throw new Error("cancelled");
    },
  });
  await app.click();
  assert.equal(app.state.pendingTransfer, undefined);
  assert.equal(app.calls.transfers.length, 0);
});

test("a restarted worker retries a ready saved action only on explicit notification click", async () => {
  const state = {
    token: "existing",
    pendingTransfer: { link, phase: "ready", createdAt: Date.now() },
  };
  const app = createHarness({ state });
  await app.startup();
  assert.equal(app.calls.transfers.length, 0);
  await app.notification("auth-retry");
  assert.deepEqual(
    app.calls.transfers.map((request) => request.url),
    [link],
  );
});

for (const phase of ["sending", "uncertain"]) {
  test(`worker restart never replays a ${phase} POST`, async () => {
    const app = createHarness({
      state: { token: "existing", pendingTransfer: { link, phase, createdAt: Date.now() } },
    });
    await app.startup();
    await app.click();
    await app.notification("auth-retry");
    assert.equal(app.calls.transfers.length, 0);
    await app.notification("transfer-uncertain");
    assert.equal(app.calls.tabs[0].url, "https://app.put.io/transfers");
    assert.equal(app.state.pendingTransfer, undefined);
  });
}

for (const transfer of [
  () => response(503),
  () => {
    throw new Error("offline");
  },
]) {
  test("ambiguous transfer failures retain an uncertain action and never reauthenticate", async () => {
    const app = createHarness({ state: { token: "existing" }, transfer });
    await app.click();
    assert.equal(app.calls.transfers.length, 1);
    assert.equal(app.calls.auth, 0);
    assert.equal(app.state.pendingTransfer.phase, "uncertain");
  });
}

test("terminal transfer rejection clears the pending record", async () => {
  const app = createHarness({ state: { token: "existing" }, transfer: () => response(400) });
  await app.click();
  assert.equal(app.state.pendingTransfer, undefined);
  assert.equal(app.calls.auth, 0);
});

test("an abandoned saved link expires before another selected action", async () => {
  const app = createHarness({
    state: {
      token: "existing",
      pendingTransfer: { link, phase: "ready", createdAt: Date.now() - 16 * 60 * 1000 },
    },
  });
  await app.click("https://example.invalid/new.torrent");
  assert.equal(app.state.pendingTransfer, undefined);
  assert.deepEqual(
    app.calls.transfers.map((request) => request.url),
    ["https://example.invalid/new.torrent"],
  );
});

test("failed durable token storage leaves the action ready without sending", async () => {
  const app = createHarness({
    beforeTokenWrite: () => {
      throw new Error("storage unavailable");
    },
  });
  await app.click();
  assert.equal(app.calls.transfers.length, 0);
  assert.equal(app.state.token, undefined);
  assert.equal(app.state.pendingTransfer.phase, "ready");
});

test("an old uncertain notification cannot discard a newer ready action", async () => {
  const app = createHarness({
    state: { token: "existing", pendingTransfer: { link, phase: "ready", createdAt: Date.now() } },
  });
  await app.notification("transfer-uncertain");
  assert.equal(app.state.pendingTransfer.link, link);
  assert.equal(app.calls.transfers.length, 0);
});

test("slow startup validation neither blocks a selected link nor removes its new token", async () => {
  let finishValidation;
  const oldValidation = new Promise((resolve) => {
    finishValidation = resolve;
  });
  let validations = 0;
  const app = createHarness({
    state: { token: "expired" },
    validate: () => (++validations === 1 ? oldValidation : response(200)),
    transfer: (request) => response(request.token === "token expired" ? 401 : 200),
  });
  const startup = app.startup();
  await new Promise(setImmediate);
  await app.click();
  finishValidation(response(401));
  await startup;
  assert.equal(app.state.token, "new-token");
  assert.equal(app.calls.transfers.length, 2);
  assert.equal(app.calls.auth, 1);
});
