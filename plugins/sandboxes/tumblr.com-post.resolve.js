(function() {
  "use strict";
  try {
    var ogI = responseText.match(/<meta property="og:image" content="(.+?)"/i);
    var type = responseText.match(/<meta property="og:type" content="(?:.+?:)?(.+?)"/i)[1];
    var obj = responseText.match(/<script.*?type="application\/ld\+json">(.+?)<\/script>/i);
    var url = null;
    var name = null;
    if (!!obj && !!obj[1]) {
      obj = JSON.parse(obj[1]);
      var obT = typeof obj.image;
      if (obT === "string") {
        queueDownload(obj.image);
      }
      else if (obT === "object") {
        for (var i of obj.image["@list"]) {
          queueDownload(i);
        }
      }
      if (type === "video") {
        name = ogI[1].match(/\/(tumblr_[a-zA-Z\d]+)(?:_r\d+)?_frame/)[1];
        url = "https://www.tumblr.com/video_file/" + baseURL.match(/\/post\/(\d+)/)[1] + "/" + name;
        name = name + ".mp4";
      }
      else {
        throw new Error("Media not located in object.");
      }
    }
    else if (!!ogI && !!ogI[1]) {
      url = ogI[1];
    }
    else {
      throw new Error("Media not located in page.");
    }
    setURL(url, name);
  }
  catch (e) {
    log(e.message);
  }
  finally {
    finish();
  }
})();
