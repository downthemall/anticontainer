(function() {
	try {
		if (~responseText.indexOf("<h1>File not found!</h1>")) {
			markGone("File not found!");
			return;
		}
		var url = responseText.match(/rel="image_src"\s+href="(.+?)"/i)[1];
		var name = responseText.match(/id=['"]image-title['"]>(.*?)</) || null;
		if (name) {
			var ext = url.replace(/\?.*$/, "").match(/\.[\w\d+]+$/);
			name = name[1] + ((ext && ext[0]) || ".jpg");
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