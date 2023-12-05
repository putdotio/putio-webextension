// to be platform independent
if (typeof browser === "undefined") {
    var browser = chrome;
}

var clientID = '2939'
var apiURL = 'https://api.put.io/v2'
var appURL = 'https://app.put.io'
var notificationIcon = browser.runtime.getURL('icon-notify.png')

browser.storage.local.get().then(storage => {
  if (!storage.token) {
    return startAuthFlow()
  }

  return validateToken(storage.token, { notify: false })
})

function startAuthFlow() {
  var redirectURL = browser.identity.getRedirectURL()
  var authURL = apiURL + '/oauth2/authenticate'
  authURL += '?client_id=' + clientID
  authURL += '&response_type=token'
  authURL += '&redirect_uri=' + encodeURIComponent(redirectURL)

  return browser.identity.launchWebAuthFlow(
    {
      interactive: true,
      url: authURL,
    },
    handleAuthCallback,
  )
}

function handleAuthCallback(redirectURL) {
  var token = redirectURL.split('#access_token=')[1]
  validateToken(token, { notify: true })
}

function validateToken(token, options) {
  fetch(apiURL + '/oauth2/validate', {
    headers: {
      authorization: 'token ' + token,
    },
  })
    .then(function(response) {
      if (response.ok) {
        return validateTokenSuccess(token, options)
      }

      return validateTokenFailure(response)
    })
    .catch(validateTokenFailure)
}

function validateTokenSuccess(token, options) {
  console.log('PutioWebExtension - Token validated!')

  browser.storage.local.set({
    token: token,
  })

  if (options && options.notify) {
    browser.notifications.create('validate-success', {
      type: 'basic',
      iconUrl: notificationIcon,
      title: browser.i18n.getMessage('welcomeNotificationTitle'),
      message: browser.i18n.getMessage('welcomeNotificationMessage'),
    })
  }

  return boot(token)
}

function validateTokenFailure(error) {
  console.error('PutioWebExtension - Token validation failed: ', error)
  return startAuthFlow()
}

function boot(token) {
  function startTransfer(link) {
    browser.notifications.create('transfer-start', {
      type: 'basic',
      iconUrl: notificationIcon,
      title: browser.i18n.getMessage('transferStartNotificationTitle'),
      message: browser.i18n.getMessage('transferStartNotificationMessage'),
    })

    fetch(apiURL + '/transfers/add', {
      method: 'POST',
      body: JSON.stringify({ url: link }),
      headers: {
        Authorization: 'token ' + token,
        'content-type': 'application/json; charset=utf-8',
      },
    })
      .then(function(response) {
        if (response.ok) {
          return startTransferSuccess()
        }

        return startTransferFailure(response)
      })
      .catch(startTransferFailure)
  }

  function startTransferSuccess() {
    console.log('PutioWebExtension - Transfer started!')
  }

  function startTransferFailure(error) {
    console.error('PutioWebExtension - Transfer failed: ', error)

    browser.notifications.create('transfer-start-failure', {
      type: 'basic',
      iconUrl: notificationIcon,
      title: browser.i18n.getMessage('transferFailureNotificationTitle'),
      message: browser.i18n.getMessage('transferFailureNotificationMessage'),
    })
  }

  browser.contextMenus.create({
    id: 'download-link',
    title: browser.i18n.getMessage('downloadMenuItem'),
    contexts: ['link'],
  })

  browser.contextMenus.create({
    id: 'download-page',
    title: browser.i18n.getMessage('downloadPageMenuItem'),
    contexts: ['page'],
  })

  browser.contextMenus.onClicked.addListener((item, tab) => {
    if (item.menuItemId === 'download-link') {
      startTransfer(item.linkUrl)
    }
    if (item.menuItemId === 'download-page') {
      startTransfer(tab.url)
    }
  })

  browser.notifications.onClicked.addListener(function(notificationId) {
    if (notificationId === 'transfer-start') {
      browser.tabs.create({
        active: true,
        url: appURL + '/transfers',
      })
    }

    browser.notifications.clear(notificationId)
  })

  browser.action.onClicked.addListener(function() {
    browser.tabs.create({
      active: true,
      url: appURL,
    })
  })
}
