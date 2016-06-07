"use strict";

try {
	let m = /source id="mp4Source" src="(.+?)"/.exec(responseText);
	if (!m) {
		m = /source id="webmSource" src="(.+?)"/.exec(responseText);
	}
	if (!m) {
		throw Error("no link");
	}
	m = m[1];
	let n = /property="og:title" content="(.+?) - Create, Discover and Share GIFs on Gfycat"/.exec(responseText);
	n = n && n[1];
	if (n) {
		let ext = /(?:\.([^./]+))?$/.exec(m);
		ext = (ext && ext[1]) || "jpg";
		n = `${n}.${ext}`;
	}
	setURL(m, n);
}
finally {
	finish();
}
