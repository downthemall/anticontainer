var http = new XMLHttpRequest();
var url = baseURL;
http.open("GET", url, true);
http.onload = function() {
	var p = new RegExp(/javascript\">[^<]+if \(document\.getElementById\('fimage/);
	var m = p.exec(http.responseText);
	if (m && m.length >= 1) {
		var out="";
		out=m[0].replace("javascript\">","");
		out=out.replace(/if \([^<]+/,"");
		out=out.replace("document.getElementById('dlbutton').href","ev");
		eval(out);
		setURL(ev);
	}
	else markGone();
	finish();
}
http.onerror = function() {
	markGone();
	finish();
}
http.send();
