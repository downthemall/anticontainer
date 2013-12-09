makeRequest(baseURL.replace(/\/gallery\//, '/a/'), function(r) {
	if (r.status < 400) {
		setURL(baseURL.replace(/\/gallery\//, '/a/'));
	}
	else {
		setURL(baseURL.replace(/\/gallery\//, '/'));
	}
	finish();
}, function() {
	finish();
});