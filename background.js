function onClick(info, tab) {
  var url = 'https://app.put.io/magnet?url=' + encodeURIComponent(info.linkUrl);
  browser.tabs.create({ url: url});
}

browser.contextMenus.create({
  "title" :browser.i18n.getMessage("downloadMenuItem"),
  "contexts" : ["link"],
  "onclick" : onClick
});
