var apiURL = 'https://api.put.io/v2'
var appURL = 'https://app.put.io'
var storageKey = 'putio-webextension'
var notificationIcon = browser.extension.getURL('icon-notify.png')

browser
  .browserAction.onClicked.addListener(function() {
    browser.tabs.create({
      active: true,
      url: appURL,
    })
  })

browser
  .storage.local.get()
  .then((storage) => {
    var extensionStorage = storage[storageKey]

    if (!extensionStorage || !extensionStorage.token) {
      authorize()
    } else {
      initialize(extensionStorage.token)
    }
  })

function authorize() {
  var redirectURL = browser.identity.getRedirectURL()
  var clientID = '2939'

  var authURL = apiURL + '/oauth2/authenticate'

  authURL += ('?client_id=' + clientID)
  authURL += ('&response_type=token')
  authURL += ('&redirect_uri=' + encodeURIComponent(redirectURL))

  return browser.identity.launchWebAuthFlow({
    interactive: true,
    url: authURL,
  }, validate)
}

function validate(redirectURL) {
  var token = redirectURL.split('#access_token=')[1]

  if (token) {
    browser.notifications.create('validate-success', {
      type: 'basic',
      iconUrl: notificationIcon,
      title: browser.i18n.getMessage('welcomeNotificationTitle'),
      message: browser.i18n.getMessage('welcomeNotificationMessage'),
    })

    browser
      .storage.local.set({
        [storageKey]: { token: token },
      })
      .then(() => initialize(token))
  }
}

function initialize(token) {
  function onDownload(info, tab) {
    browser.notifications.create('transfer-start', {
      type: 'basic',
      iconUrl: notificationIcon,
      title: browser.i18n.getMessage('transferStartNotificationTitle'),
      message: browser.i18n.getMessage('transferStartNotificationMessage'),
    })

    var url = apiURL + '/transfers/add'

    var data = JSON.stringify({
      url: info.linkUrl,
    })

    var xhr = new XMLHttpRequest()

    xhr.open('POST', url, true)
    xhr.setRequestHeader('Content-type','application/json; charset=utf-8')
    xhr.setRequestHeader('authorization', 'token ' + token)

    xhr.onload = function () {
      if (!xhr.readyState == 4) {
        const response = JSON.parse(xhr.responseText)

        browser.notifications.create('transfer-start-failure', {
          type: 'basic',
          iconUrl: notificationIcon,
          title: browser.i18n.getMessage('transferFailureNotificationTitle'),
          message: browser.i18n.getMessage('transferFailureNotificationMessage'),
        })
      }
    }

    xhr.send(data)
  }

  browser.contextMenus.create({
    title: browser.i18n.getMessage('downloadMenuItem'),
    contexts: ['link'],
    onclick: onDownload,
  })

  browser.notifications.onClicked.addListener(function(notificationId) {
    if (notificationId === 'transfer-start') {
      var url = appURL + '/transfers'

      browser.tabs.create({
        active: true,
        url: url,
      })
    }

    browser.notifications.clear(notificationId)
  })
}

