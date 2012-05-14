var url = /^.+\/photos\/.+?\/\d+\//.exec(baseURL)[0] + 'sizes/';

function loadSize (size, errCallback) {
	with (new Request()) {
		onload = function() {
			var m = /src="([^"]+staticflickr.com[^"]+)"/.exec(responseText);
			if (m) {
				setURL(m[1]);
				finish();
			}
			else {
				errCallback();
			}
		};
		onerror = function() {
			errCallback();
		};
		open('GET', url + size);
		send();
	}
}

loadSize('o', function() {
	loadSize('l', function() {
		markGone();
		finish();
	});
});