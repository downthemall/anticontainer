	log(responseText.indexOf("feedPreload"));
	var entries = responseText.match(/feedPreload\s*:\s*(.+)\},$/m);
	log(entries);
	log(entries[1]);
	entries = JSON.parse(entries[1]).feed.entry;
	for (var e of entries) {
		log(e);
		for (var l of e.link) {
			log(l);
			if (l.rel == "http://schemas.google.com/photos/2007#canonical") {
				log(l.href);
				addDownload(l.href);
			}
		}
	}
	setURL(null);
	finish();
