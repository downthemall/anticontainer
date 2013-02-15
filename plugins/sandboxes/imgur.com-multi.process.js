var pieces = baseURL.split("/").pop().split(",");
log(pieces.toString());
for (var p of pieces) {
	log(p);
	addDownload(p);
}
setURL(null);
finish();