"use strict";
var http = new XMLHttpRequest();
var url = baseURL;
http.open("GET", url, true);
http.onload = function() {
	var p = /javascript\">[^<]+if \(document\.getElementById\('fimage/;
	var m = p.exec(http.responseText);
	if (m && m.length >= 1) {
		var ev;
		var out = m[0].replace("javascript\">", "");
		out = out.replace(/if \([^<]+/, "");
		out = out.replace("document.getElementById('dlbutton').href","ev");
		eval(out); // executed in the sandbox only
		setURL(ev);
	}
	else {
		markGone();
	}
	finish();
};
http.onerror = function() {
	markGone();
	finish();
};
http.send();
