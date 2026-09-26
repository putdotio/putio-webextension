// Firefox provides the promise-based `browser` namespace; Chrome MV3
// service workers only provide `chrome`, which returns promises for the
// APIs used here.
if (typeof browser === "undefined") {
  var browser = chrome;
}

var clientID = "2939";
var apiURL = "https://api.put.io/v2";
var appURL = "https://app.put.io";

// MV3 renamed the MV2 `browserAction` toolbar API to `action`.
var toolbarAction = browser.action || browser.browserAction;

// Chrome MV3 stops and restarts the service worker between events:
// every listener is registered at the top level, and state (the token)
// lives in browser.storage instead of globals.

browser.runtime.onInstalled.addListener(initialize);
browser.runtime.onStartup.addListener(initialize);

browser.contextMenus.onClicked.addListener(function (item, tab) {
  var link;

  if (item.menuItemId === "download-link") {
    link = item.linkUrl;
  }

  if (item.menuItemId === "download-page") {
    link = tab.url;
  }

  if (!link) {
    return;
  }

  return sendSelectedLink(link).catch(notifyAuthUnavailable);
});

browser.notifications.onClicked.addListener(function (notificationId) {
  browser.notifications.clear(notificationId);
  if (notificationId === "transfer-start" || notificationId === "transfer-uncertain") {
    browser.tabs.create({ active: true, url: appURL + "/transfers" });
    return runOperation(async function () {
      var pending = await getPendingTransfer();
      if (pending && pending.phase !== "ready") {
        await clearPendingTransfer();
      }
    });
  }
  if (notificationId === "auth-retry") {
    return runOperation(resumeTransfer);
  }
});

toolbarAction.onClicked.addListener(function () {
  browser.tabs.create({
    active: true,
    url: appURL,
  });
});

async function initialize() {
  createContextMenus();
  // Startup validation must not block a click or invalidate a credential
  // obtained by a user operation while this request was in flight.
  var generation = operationGeneration;
  var superseded = function () {
    return generation !== operationGeneration || activeOperation !== null;
  };
  try {
    var pending = await getPendingTransfer(false);
    if (pending) notifyPending(pending);
    var token = await getToken();
    if (!token) return;
    var result = await validateToken(token);
    if (superseded()) return;
    if (result === "rejected") {
      if ((await getToken()) === token && !superseded()) {
        await browser.storage.local.remove("token");
      }
    } else if (result === "unavailable") {
      notifyAuthUnavailable();
    }
  } catch {
    if (!superseded()) notifyAuthUnavailable();
  }
}

function createContextMenus() {
  createContextMenuItem({
    id: "download-link",
    title: browser.i18n.getMessage("downloadMenuItem"),
    contexts: ["link"],
  });

  createContextMenuItem({
    id: "download-page",
    title: browser.i18n.getMessage("downloadPageMenuItem"),
    contexts: ["page"],
  });
}

function createContextMenuItem(properties) {
  browser.contextMenus.create(properties, function () {
    // Menus persist across service-worker restarts in Chrome; reading
    // lastError swallows the duplicate-id error on re-creation.
    void browser.runtime.lastError;
  });
}

function getToken() {
  return browser.storage.local.get("token").then(function (storage) {
    return storage.token;
  });
}

// The promise serializes this worker only. The selected link and send phase are
// durable, so restarting an MV3 worker cannot replay an uncertain POST.
var activeOperation = null;
var operationGeneration = 0;
var pendingMaxAge = 15 * 60 * 1000;
var pendingStorage = Promise.resolve();

// Keep expiry reads/removals ordered with new recovery writes. This queue owns
// storage operations only; it never waits for network requests or sign-in.
function updatePendingStorage(operation) {
  var result = pendingStorage.then(operation);
  pendingStorage = result.catch(function () {});
  return result;
}

function clearPendingTransfer() {
  return updatePendingStorage(function () {
    return browser.storage.local.remove("pendingTransfer");
  });
}

async function sendSelectedLink(link) {
  operationGeneration += 1;
  var token = await getToken();
  var pending = await getPendingTransfer();
  if (!token || pending || activeOperation) {
    return runOperation(function () {
      return selectTransfer(link);
    });
  }

  // Signed-in downloads can overlap. Only a link needing auth recovery owns
  // the durable slot; ordinary POSTs are never replayed.
  var outcome = await startTransfer(token, link);
  if (outcome === "rejected") {
    return runOperation(async function () {
      if ((await getToken()) === token) await browser.storage.local.remove("token");
      return selectTransfer(link);
    });
  }
  notifyTransferOutcome(outcome);
}

function runOperation(operation) {
  if (activeOperation) {
    notify("auth-retry", "pendingTransferTitle", "pendingTransferMessage");
    return activeOperation;
  }
  operationGeneration += 1;
  activeOperation = Promise.resolve()
    .then(operation)
    .catch(notifyAuthUnavailable)
    .finally(function () {
      activeOperation = null;
    });
  return activeOperation;
}

function getPendingTransfer(clearExpired = true) {
  return updatePendingStorage(async function () {
    var storage = await browser.storage.local.get("pendingTransfer");
    var pending = storage.pendingTransfer;
    if (!pending) return null;
    if (!isLivePendingTransfer(pending)) {
      if (clearExpired) await browser.storage.local.remove("pendingTransfer");
      return null;
    }
    return pending;
  });
}

function isLivePendingTransfer(pending) {
  var token = pending.provisionalToken;
  return (
    typeof pending.link === "string" &&
    pending.link !== "" &&
    Number.isFinite(pending.createdAt) &&
    Date.now() - pending.createdAt <= pendingMaxAge &&
    ["ready", "sending", "uncertain"].indexOf(pending.phase) >= 0 &&
    (token === undefined || (typeof token === "string" && token !== ""))
  );
}

function savePendingTransfer(pending, phase) {
  return updatePendingStorage(function () {
    return browser.storage.local.set({
      pendingTransfer: {
        link: pending.link,
        createdAt: pending.createdAt,
        phase: phase,
        ...(phase === "ready" && pending.provisionalToken
          ? { provisionalToken: pending.provisionalToken }
          : {}),
      },
    });
  });
}

function notifyPending(pending) {
  if (pending.phase === "ready") {
    notify("auth-retry", "pendingTransferTitle", "pendingTransferMessage");
  } else {
    notify("transfer-uncertain", "transferUncertainTitle", "transferUncertainMessage");
  }
}

async function selectTransfer(link) {
  var pending = await getPendingTransfer();
  if (pending && (pending.link !== link || pending.phase !== "ready")) {
    notifyPending(pending);
    return;
  }
  if (!pending) {
    await savePendingTransfer({ link: link, createdAt: Date.now() }, "ready");
  }
  return resumeTransfer();
}

async function resumeTransfer() {
  var pending = await getPendingTransfer();
  if (!pending) return;
  if (pending.phase !== "ready") {
    notifyPending(pending);
    return;
  }
  var token = await getToken();
  var authenticated = false;
  while (true) {
    if (!token) {
      if (authenticated) {
        await clearPendingTransfer();
        notify("auth-cancelled", "authCancelledTitle", "authCancelledMessage");
        return;
      }
      authenticated = true;
      var auth = pending.provisionalToken
        ? await validateAuthToken(pending.provisionalToken)
        : await startAuthFlow(pending);
      if (auth.state === "cancelled" || auth.state === "rejected") {
        await clearPendingTransfer();
        notify("auth-cancelled", "authCancelledTitle", "authCancelledMessage");
        return;
      }
      if (auth.state !== "ready") return;
      token = auth.token;
    }

    // A terminated worker cannot tell whether this POST was accepted. Persist
    // before sending, and require the user to check transfers after a restart.
    await savePendingTransfer(pending, "sending");
    var outcome = await startTransfer(token, pending.link);
    if (outcome === "rejected") {
      await savePendingTransfer(pending, "ready");
      await browser.storage.local.remove("token");
      token = null;
      continue;
    }
    if (outcome === "uncertain") {
      await savePendingTransfer(pending, "uncertain");
    } else {
      await clearPendingTransfer();
    }
    notifyTransferOutcome(outcome);
    return;
  }
}

async function startAuthFlow(pending) {
  var redirectURL = browser.identity.getRedirectURL();
  var authURL = apiURL + "/oauth2/authenticate";
  authURL += "?client_id=" + clientID;
  authURL += "&response_type=token";
  authURL += "&redirect_uri=" + encodeURIComponent(redirectURL);
  var callback;
  try {
    callback = await browser.identity.launchWebAuthFlow({ interactive: true, url: authURL });
  } catch {
    return { state: "cancelled" };
  }
  var token;
  try {
    token = new URLSearchParams(new URL(callback).hash.slice(1)).get("access_token");
  } catch {
    return { state: "rejected" };
  }
  if (!token) return { state: "rejected" };
  // A temporary validation outage must not require repeating interactive OAuth.
  // The provisional credential expires and clears with this one saved action.
  await savePendingTransfer({ ...pending, provisionalToken: token }, "ready");
  return validateAuthToken(token);
}

async function validateAuthToken(token) {
  var result = await validateToken(token);
  if (result !== "ready") {
    if (result === "unavailable") notifyAuthUnavailable();
    return { state: result };
  }
  await browser.storage.local.set({ token: token });
  notify("validate-success", "welcomeNotificationTitle", "welcomeNotificationMessage");
  return { state: "ready", token: token };
}

async function validateToken(token) {
  try {
    var response = await fetch(apiURL + "/oauth2/validate", {
      headers: { authorization: "token " + token },
    });
    if (response.ok) return "ready";
    return response.status === 401 ? "rejected" : "unavailable";
  } catch {
    return "unavailable";
  }
}

// Resolves "ok", "rejected" (401), "failed" (other client error), or
// "uncertain" (network failure or 5xx, the server may have accepted the POST).
async function startTransfer(token, link) {
  notify("transfer-start", "transferStartNotificationTitle", "transferStartNotificationMessage");
  var response;
  try {
    response = await fetch(apiURL + "/transfers/add", {
      method: "POST",
      body: JSON.stringify({ url: link }),
      headers: {
        Authorization: "token " + token,
        "content-type": "application/json; charset=utf-8",
      },
    });
  } catch {
    return "uncertain";
  }
  if (response.ok) return "ok";
  if (response.status === 401) return "rejected";
  return response.status >= 500 ? "uncertain" : "failed";
}

function notifyTransferOutcome(outcome) {
  if (outcome === "uncertain") {
    notify("transfer-uncertain", "transferUncertainTitle", "transferUncertainMessage");
  } else if (outcome === "failed") {
    notify(
      "transfer-start-failure",
      "transferFailureNotificationTitle",
      "transferFailureNotificationMessage",
    );
  }
}

function notifyAuthUnavailable() {
  notify("auth-retry", "authUnavailableTitle", "authUnavailableMessage");
}

function notify(id, titleKey, messageKey) {
  browser.notifications.create(id, {
    type: "basic",
    iconUrl: browser.runtime.getURL("icon-notify.png"),
    title: browser.i18n.getMessage(titleKey),
    message: browser.i18n.getMessage(messageKey),
  });
}
