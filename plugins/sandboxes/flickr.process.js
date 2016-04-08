"use strict";

var url = /^.+\/photos\/.+?\/\d+\//.exec(baseURL)[0] + 'sizes/';

function loadSize (size, errCallback) {
	let req = new XMLHttpRequest();
	req.onload = function() {
		var m = /src="([^"]+staticflickr.com[^"]+)"/.exec(req.responseText);
		if (m) {
			setURL(m[1]);
			finish();
		}
		else {
			errCallback();
		}
	};
	req.onerror = function() {
		errCallback();
	};
	req.open('GET', url + size);
	req.send();
}

loadSize('o', function() {
	loadSize('l', function() {
		markGone();
		finish();
	});
});
