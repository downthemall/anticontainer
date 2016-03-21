function get(){
	var http = new XMLHttpRequest();
	var url = baseURL;
	http.open("GET", url, true);

	http.onload = function() {
		log(http.responseText);
		var patt1 = new RegExp(/javascript\">[^<]+if \(document\.getElementById\('fimage/);
		var res1 = patt1.exec(http.responseText);
		var out="";

		out=res1[0].replace("javascript\">","");
		out=out.replace(/if \([^<]+/,"");
		out=out.replace("document.getElementById('dlbutton').href","ev");
		eval(out);

		
		setURL(ev);
		finish();
	}
	http.onerror = function() {
		log("Error loading page");
	}
	http.send();
}
get();
