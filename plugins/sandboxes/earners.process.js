"use strict";
const params = "imgContinue=Continue+to+image+...+";

let req = new XMLHttpRequest();
req.open("POST", baseURL);
req.setRequestHeader("Content-Type", "application/x-www-form-urlencoded");
req.setRequestHeader("Content-Length", params.length);
req.onload = function() {
  try {
    var url = /href=('|")(.+?)\1.*?title=('|")(.*?)\3.*?popitup/.
              exec(req.responseText);
    url = url && [url[2], url[4]];
    if (!url) {
      url =
        /class=('|")(?:centered|centred)(?:_resized)?\1.*?src=('|")(.+?)\2.*?alt=('|")(.*?)\4/.
        exec(req.responseText);
      url = url && [url[3], url[5]];
    }
    if (!url) {
      markGone();
      return;
    }
    var name = url[1];
    url = url[0];
    if (name === "image") {
      name = null;
    }
    if (name) {
      var ext = /(?:\.([^./]+))?$/.exec(url);
      if (ext) {
        ext = ext[1] || "jpg";
      }
      name = `${name}.${ext}`;
    }
    setURL(url, name);
  }
  catch (ex) {
    log(ex);
  }
  finally {
    finish();
  }
};
req.onerror = function() {
  finish();
};
req.send(params);
