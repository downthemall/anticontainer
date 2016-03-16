var reImages = /<a[^>]+href="(\/Photos\/View\/[^"]+)"/img;
var rePages = /<a href="[^"]+\/p\/(\d+)" class="pager" title="(\d+)"/ig;

var url = baseURL.match( /((http:\/\/(?:www\.)?(?:studi|mein|schueler)vz\.net)\/Photos\/Album\/[^\/]+\/[^\/]+)(?:\/p\/(\d+))?/i );
var curPage = parseInt(url[3], 10) || 1;
var maxPage = curPage;
var loaded = 0;
var images = [];

// get maximum page
var match;
while ((match = rePages.exec(responseText)) != null) {
	maxPage = Math.max(maxPage, match[2]);
}

function parsePage (page) {
	with (new Request()) {
		onload = function() {
			var m;
			while ((m = reImages.exec(responseText)) != null) {
				images[page-1].push(url[2] + m[1]);
			}
			tryContinue();
		};
		onerror = function() {
			markGone();
			finish();
		};
		open('GET', url[1] + '/p/' + page);
		send();
	}
}

function tryContinue () {
	if (++loaded < maxPage) {
		return;
	}
	for (var i = 0; i < maxPage; i++) {
		for (var url of images[i]) {
			queueDownload(url);
		}
	}
	setURL(null);
	finish();
}

for (var i = 1; i <= maxPage; i++) {
	images[i - 1] = [];
	if (i != curPage) {
		parsePage(i);
	}
	else {
		var m;
		while ((m = reImages.exec(responseText)) != null) {
			images[i - 1].push(url[2] + m[1]);
		}
		tryContinue();
	}
}
