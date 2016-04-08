"use strict";
try {
	var images = responseText.match(/image\s+:\s+({"id".*),$/m);
	images = JSON.parse(images[1]);
	for (var i of images.album_images.images) {
		queueDownload("/" + i.hash);
	}
	setURL(null);
}
finally {
	finish();
}
