for each (var p in [/href="(http:\/\/www\.hochladen\.info\/img\/.*)"/i, /showFull\('(\/img\/.*?)'/, /src="(\/img\/.*?)"/i])
{
	var m = p.exec(responseText);
	if (!m || m.length != 2) {
		continue;
	}
	this.setURL(m[1]);
	break;
}
this.finish();