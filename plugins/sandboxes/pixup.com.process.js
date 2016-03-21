function get(){
	var http = new XMLHttpRequest();
	var url = baseURL;
	log(baseURL);
	var params = "imgContinue=Continue+to+image+...+";
	http.open("POST", url, true);

	http.setRequestHeader("Content-Type", "application/x-www-form-urlencoded");
	http.setRequestHeader("Content-Length", params.length);

	http.onload = function() {
		log(http.responseText);
			var patt = new RegExp("popitup\\('(.+?)'\\)");
			var res = patt.exec(http.responseText);
			log(res[1]);
			setURL(res[1]);
			finish();
	}
	http.onerror = function() {
		log("Error loading page");
	}
	http.send(params);
}
get();