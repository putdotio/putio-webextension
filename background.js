var apiURL = 'https://api.put.io/v2'

browser
  .storage.local.get()
  .then(storage => {
    var extensionStorage = storage['putio-webextension']

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
      'putio-webextension': { token: token },
    })
    .then(() => register(token))
}

function register(token) {
  function onClick(info, tab) {
    var url = apiURL + '/transfers/add'

    var data = JSON.stringify({
      url: info.linkUrl,
    })

    var xhr = new XMLHttpRequest()

    xhr.open('POST', url, true)
    xhr.setRequestHeader('Content-type','application/json; charset=utf-8')
    xhr.setRequestHeader('authorization', 'token ' + token)

    // @TODO Show notifications
    xhr.onload = function () {
      if (xhr.readyState == 4) {
        console.log(xhr.responseText)
      } else {
        console.error(xhr.responseText)
      }
    }

    xhr.send(data)
  }

  browser.contextMenus.create({
    title: browser.i18n.getMessage('downloadMenuItem'),
    contexts: ['link'],
    onclick: onClick,
  })
}

