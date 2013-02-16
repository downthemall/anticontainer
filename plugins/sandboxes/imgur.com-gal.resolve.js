try {
	var images = responseText.match(/images\s+:\s+(\{"count":(?:[\r\n]|.)+?}]}),$/m);
	images = JSON.parse(images[1]);
	for (var i of images.items) {
		queueDownload("/" + i.hash);
	}
	setURL(null);
}
finally {
	finish();
}