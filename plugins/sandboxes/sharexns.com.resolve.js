try {
	var match = responseText.match(/href="(.+?)">[\s\r\n]*?<span>original/);
	var url = composeURL(baseURL, match[1]);
	makeRequest(url, function(r) {
		try {
			var img = r.responseText.match(/class="view_photo"[\s\r\n]*?src="(.*?)"/);
			setURL(img[1]);
		}
		finally {
			finish();
		}
	}, function() {
		finish();
	});
	makeRequest(baseURL + '&pjk=l', resolve, resolve);
}
catch (ex) {
	finish();
}
