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

  getToken().then(function (token) {
    if (!token) {
      return startAuthFlow();
    }

    return startTransfer(token, link);
  });
});

browser.notifications.onClicked.addListener(function (notificationId) {
  if (notificationId === "transfer-start") {
    browser.tabs.create({
      active: true,
      url: appURL + "/transfers",
    });
  }

  browser.notifications.clear(notificationId);
});

toolbarAction.onClicked.addListener(function () {
  browser.tabs.create({
    active: true,
    url: appURL,
  });
});

function initialize() {
  createContextMenus();

  getToken().then(function (token) {
    if (!token) {
      return startAuthFlow();
    }

    return validateToken(token, { notify: false });
  });
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

function startAuthFlow() {
  var redirectURL = browser.identity.getRedirectURL();
  var authURL = apiURL + "/oauth2/authenticate";
  authURL += "?client_id=" + clientID;
  authURL += "&response_type=token";
  authURL += "&redirect_uri=" + encodeURIComponent(redirectURL);

  return browser.identity
    .launchWebAuthFlow({
      interactive: true,
      url: authURL,
    })
    .then(handleAuthCallback)
    .catch(function (error) {
      console.error("PutioWebExtension - Auth flow failed: ", error);
    });
}

function handleAuthCallback(redirectURL) {
  // Cancellation rejects the promise (handled by the caller's catch); this
  // guards a completed flow whose redirect carries no access token.
  var token = redirectURL && redirectURL.split("#access_token=")[1];

  if (!token) {
    console.error("PutioWebExtension - Auth flow returned no access token");
    return;
  }

  return validateToken(token, { notify: true });
}

function validateToken(token, options) {
  return fetch(apiURL + "/oauth2/validate", {
    headers: {
      authorization: "token " + token,
    },
  })
    .then(function (response) {
      if (response.ok) {
        return validateTokenSuccess(token, options);
      }

      return validateTokenFailure(response);
    })
    .catch(validateTokenFailure);
}

function validateTokenSuccess(token, options) {
  console.log("PutioWebExtension - Token validated!");

  browser.storage.local.set({
    token: token,
  });

  if (options && options.notify) {
    notify("validate-success", "welcomeNotificationTitle", "welcomeNotificationMessage");
  }
}

function validateTokenFailure(error) {
  console.error("PutioWebExtension - Token validation failed: ", error);
  return startAuthFlow();
}

function startTransfer(token, link) {
  notify("transfer-start", "transferStartNotificationTitle", "transferStartNotificationMessage");

  return fetch(apiURL + "/transfers/add", {
    method: "POST",
    body: JSON.stringify({ url: link }),
    headers: {
      Authorization: "token " + token,
      "content-type": "application/json; charset=utf-8",
    },
  })
    .then(function (response) {
      if (response.ok) {
        return startTransferSuccess();
      }

      return startTransferFailure(response);
    })
    .catch(startTransferFailure);
}

function startTransferSuccess() {
  console.log("PutioWebExtension - Transfer started!");
}

function startTransferFailure(error) {
  console.error("PutioWebExtension - Transfer failed: ", error);

  notify(
    "transfer-start-failure",
    "transferFailureNotificationTitle",
    "transferFailureNotificationMessage",
  );
}

function notify(id, titleKey, messageKey) {
  browser.notifications.create(id, {
    type: "basic",
    iconUrl: browser.runtime.getURL("icon-notify.png"),
    title: browser.i18n.getMessage(titleKey),
    message: browser.i18n.getMessage(messageKey),
  });
}
