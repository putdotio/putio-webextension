function getClickHandler() {
  return function(info, tab) {
    var url = 'https://put.io/magnet?url=' + info.linkUrl;
    chrome.tabs.create({ url: url});
  };
};

chrome.contextMenus.create({
  "title" : "Download with put.io",
  "type" : "normal",
  "contexts" : ["link"],
  "onclick" : getClickHandler()
});
