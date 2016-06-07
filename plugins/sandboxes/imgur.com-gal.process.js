"use strict";
try {
	var id = baseURL.match(/\/a\/([^/]+)/);
	if (!id) {
		throw new Error("No id");
	}
	id = id[1];
	makeRequest(`https://imgur.com/ajaxalbums/getimages/${id}/hit.json?all=true`, r => {
		try {
			let data = JSON.parse(r.responseText);
			for (var i of data.data.images) {
				queueDownload(`https://imgur.com/${i.hash}`);
			}
		}
		catch(ex) {
			log(ex.message || ex, ex);
		}
		finally {
			finish();
		}
	}, r => {
		finish();
	});
}
catch(ex) {
	log(ex.message || ex, ex);
	finish();
}
