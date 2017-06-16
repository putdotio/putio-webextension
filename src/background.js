var apiURL = 'https://api.put.io/v2'
var storageKey = 'putio-webextension'

browser
  .storage.local.get()
  .then(storage => {
    var extensionStorage = storage.storageKey

    if (!extensionStorage || !extensionStorage.token) {
      authorize()
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

  browser
    .storage.local.set({
      [storageKey]: { token: token },
    })
    .then(() => initialize(token))
}

function initialize(token) {
  var notificationIcon = browser.extension.getURL('icon-notify.png')

  function onDownload(info, tab) {
    var url = apiURL + '/transfers/add'

    var data = JSON.stringify({
      url: info.linkUrl,
    })

    var xhr = new XMLHttpRequest()

    xhr.open('POST', url, true)
    xhr.setRequestHeader('Content-type','application/json; charset=utf-8')
    xhr.setRequestHeader('authorization', 'token ' + token)

    xhr.onload = function () {
      if (xhr.readyState == 4) {
        const response = JSON.parse(xhr.responseText)

        browser.notifications.create('transfer-start-success', {
          type: 'basic',
          iconUrl: notificationIcon,
          title: 'Transfer Started!',
          message: 'We will let you know when ' + response.transfer.name + ' is downloaded!',
        })
      } else {
        const response = JSON.parse(xhr.responseText)

        browser.notifications.create('transfer-start-failure', {
          type: 'basic',
          iconUrl: notificationIcon,
          title: 'Oops!',
          message: 'We are unable to download that :/',
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
    console.log(notificationId)

    switch (notificationId) {
      case 'transfer-start-success':
      case 'transfer-start-failure':
        browser.notifications.clear(notificationId)
        break

      default:
        break
    }
  })
}

