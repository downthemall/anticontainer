function get(){
	var http = new XMLHttpRequest();
	var url = baseURL;
	var patt1 = new RegExp("\.net/(.+)");
	var res1 = patt1.exec(baseURL);
	log(baseURL);
	var params = "op=view&id="+res1[1]+"&pre=30&next=Continue+to+image...";
	log(params);
	http.open("POST", url, true);

	http.setRequestHeader("Content-Type", "application/x-www-form-urlencoded");
	http.setRequestHeader("Content-Length", params.length);

	http.onload = function() {
		log(http.responseText);
			var patt = new RegExp("src=\"(.+?)\" class=\"pic\" alt=\"(.+?)\"");
			var res = patt.exec(http.responseText);
			log(res[1]);
			setURL(res[1],res[2]);
			finish();
	}
	http.onerror = function() {
		log("Error loading page");
	}
	http.send(params);
}
get();