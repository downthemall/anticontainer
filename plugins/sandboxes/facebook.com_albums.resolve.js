"use strict";

var rePhotoLink =
	/<a[^>]+href="(https?:\/\/(?:www\.)?facebook\.com\/photo\.php[^"]+)"/img;
var photos = [];
function loadNextPage(id) {
	let req = new XMLHttpRequest();
	req.onload = function() {
		processText(req.responseText);
	};
	req.onerror = function() {
		markGone();
		finish();
	};
	req.open('GET', baseURL + '&aft=' + id);
	req.send();
}
function processText (text, noloadNext) {
	var lastId, m;
	while ((m = rePhotoLink.exec(text))) {
		photos.push(m[1]);
		lastId = m[2];
	}
	if (!!lastId && !noloadNext) {
		loadNextPage(lastId);
	}
	else {
		for (var url of photos) {
			queueDownload(url);
		}
		setURL(null);
		finish();
	}
}
processText(responseText, responseText.indexOf('uiMorePagerPrimary') < 0);
