(function() {
	try {
		if (~responseText.indexOf("<h1>File not found!</h1>")) {
			markGone("File not found!");
			return;
		}
		var url = responseText.match(/rel="image_src"\s+href="(.+?)"/i);
		if (!url) {
			url = responseText.match(/"twitter:player:stream"\s+content="(.+?)"/i);
		}
		url = url[1];
		var name = responseText.match(/['"]twitter:title['"] content="(.*?)"/) || null;
		if (name && !/^imgur/i.test(name[1])) {
			var ext = url.replace(/\?.*$/, "").match(/\.[\w\d+]+$/);
			name = name[1] + ((ext && ext[0]) || ".jpg");
		}
		else {
			name = null;
		}
		if (!~url.indexOf("?")) {
			url = url + "?download";
		}
		setURL(url, name);
	}
	finally {
		finish();
	}
})();