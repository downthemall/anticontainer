var http = new XMLHttpRequest();
var url = baseURL;
var params = "imgContinue=CLICK+CONTINUE+TO+IMAGE..";
http.open("POST", url, true);
http.setRequestHeader("Content-Type", "application/x-www-form-urlencoded");
http.setRequestHeader("Content-Length", params.length);
http.onload = function() {
	var p = new RegExp(/class='centred' src='(.+?)' alt='image'/);
	var m = p.exec(http.responseText);
	if (m && m.length >= 2) setURL(m[1]);
	else markGone();
	finish();
}
http.onerror = function() {
	markGone();
	finish();
}
http.send(params);
