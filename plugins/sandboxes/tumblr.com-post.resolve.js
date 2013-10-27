(function() {
	try {
		var url = responseText.match(/<meta property="og:image" content="(.+?)"/)[1];
		var name = responseText.match(/<meta property="og:description" content="(.*?)"/);
		if (name && name[1].length) {
			var ext = url.replace(/\?.*$/, "").match(/\.[\w\d+]+$/);
			name = name[1] + ((ext && ext[0]) || ".jpg");
		}
		setURL(url, name);
	}
	finally {
		finish();
	}
})();