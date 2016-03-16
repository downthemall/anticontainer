var rePhotoLink = /<a[^>]+href="(https?:\/\/(?:www\.)?facebook\.com\/photo\.php[^"]+)"/img;
var photos = [];
function loadNextPage (id) {
	with (new Request()) {
		onload = function() {
			processText(responseText);
		};
		onerror = function() {
			markGone();
			finish();
		};
		open('GET', baseURL + '&aft=' + id);
		send();
	}
}
function processText (text, noloadNext) {
	var lastId, m;
	while ((m = rePhotoLink.exec(text)) != null) {
		photos.push(m[1]);
		lastId = m[2];
	}
	if (!!lastId && !noloadNext) {
		loadNextPage(lastId)
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
