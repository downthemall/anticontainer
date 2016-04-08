"use strict";
var pieces = baseURL.split("/").pop().split(",");
log(pieces.toString());
for (var p of pieces) {
	queueDownload(p);
}
setURL(null);
finish();
