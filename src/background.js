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

  return sendSelectedLink(link).catch(function () {
    notify("auth-retry", "authUnavailableTitle", "authUnavailableMessage");
  });
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
  var generation = operationGeneration;
  try {
    var pending = await getPendingTransfer(false);
    if (pending) notifyPending(pending);
    var token = await getToken();
    if (!token) return;
    var result = await validateToken(token);
    // Startup validation must not block a click or invalidate a credential
    // obtained by a user operation while this request was in flight.
    if (result === "rejected" && generation === operationGeneration && !activeOperation) {
      var currentToken = await getToken();
      if (currentToken === token && generation === operationGeneration && !activeOperation) {
        await browser.storage.local.remove("token");
      }
    } else if (result === "unavailable" && generation === operationGeneration && !activeOperation) {
      notify("auth-retry", "authUnavailableTitle", "authUnavailableMessage");
    }
  } catch {
    if (generation === operationGeneration && !activeOperation) {
      notify("auth-retry", "authUnavailableTitle", "authUnavailableMessage");
    }
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

  // Signed-in downloads can overlap, as before. Only a link needing auth
  // recovery owns the durable slot; ordinary POSTs are never replayed.
  var response = await startTransfer(token, link);
  if (response && response.status === 401) {
    return runOperation(async function () {
      if ((await getToken()) === token) await browser.storage.local.remove("token");
      return selectTransfer(link);
    });
  }
  if (!response || response.status >= 500) {
    notify("transfer-uncertain", "transferUncertainTitle", "transferUncertainMessage");
  } else if (!response.ok) {
    notify(
      "transfer-start-failure",
      "transferFailureNotificationTitle",
      "transferFailureNotificationMessage",
    );
  }
}

function runOperation(operation) {
  if (activeOperation) {
    notify("auth-retry", "pendingTransferTitle", "pendingTransferMessage");
    return activeOperation;
  }
  operationGeneration += 1;
  activeOperation = Promise.resolve()
    .then(operation)
    .catch(function () {
      notify("auth-retry", "authUnavailableTitle", "authUnavailableMessage");
    })
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
    if (
      typeof pending.link !== "string" ||
      !pending.link ||
      !Number.isFinite(pending.createdAt) ||
      Date.now() - pending.createdAt > pendingMaxAge ||
      ["ready", "sending", "uncertain"].indexOf(pending.phase) < 0 ||
      (pending.provisionalToken !== undefined &&
        (typeof pending.provisionalToken !== "string" || !pending.provisionalToken))
    ) {
      if (clearExpired) await browser.storage.local.remove("pendingTransfer");
      return null;
    }
    return pending;
  });
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
    var response = await startTransfer(token, pending.link);
    if (response && response.ok) {
      await clearPendingTransfer();
      return;
    }
    if (response && response.status === 401) {
      await savePendingTransfer(pending, "ready");
      await browser.storage.local.remove("token");
      token = null;
      continue;
    }
    if (!response || response.status >= 500) {
      await savePendingTransfer(pending, "uncertain");
      notify("transfer-uncertain", "transferUncertainTitle", "transferUncertainMessage");
    } else {
      await clearPendingTransfer();
      notify(
        "transfer-start-failure",
        "transferFailureNotificationTitle",
        "transferFailureNotificationMessage",
      );
    }
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
    if (result === "unavailable") {
      notify("auth-retry", "authUnavailableTitle", "authUnavailableMessage");
    }
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

async function startTransfer(token, link) {
  notify("transfer-start", "transferStartNotificationTitle", "transferStartNotificationMessage");
  try {
    return await fetch(apiURL + "/transfers/add", {
      method: "POST",
      body: JSON.stringify({ url: link }),
      headers: {
        Authorization: "token " + token,
        "content-type": "application/json; charset=utf-8",
      },
    });
  } catch {
    return null;
  }
}

function notify(id, titleKey, messageKey) {
  browser.notifications.create(id, {
    type: "basic",
    iconUrl: browser.runtime.getURL("icon-notify.png"),
    title: browser.i18n.getMessage(titleKey),
    message: browser.i18n.getMessage(messageKey),
  });
}
