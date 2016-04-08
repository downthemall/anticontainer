"use strict";
var http = new XMLHttpRequest();
var url = baseURL;
var p1 = new RegExp("\.net/(.+)");
var m1 = p1.exec(baseURL);
var params = "op=view&id="+m1[1]+"&pre=30&next=Continue+to+image...";
http.open("POST", url, true);
http.setRequestHeader("Content-Type", "application/x-www-form-urlencoded");
http.setRequestHeader("Content-Length", params.length);
http.onload = function() {
	var p = new RegExp("src=\"(.+?)\" class=\"pic\" alt=\"(.+?)\"");
	var m = p.exec(http.responseText);
	if (m && m.length >= 3) {
		setURL(m[1],m[2]);
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
http.send(params);
