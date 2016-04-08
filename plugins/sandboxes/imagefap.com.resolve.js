"use strict";

var lD = function (s) {
  var s1 = unescape(s.substr(0, s.length - 1));
  var t = "";
  for (var i = 0; i < s1.length; i++) {
    t += String.fromCharCode(s1.charCodeAt(i) - s.substr(s.length - 1, 1));
  }
  return unescape(t);
};

function doit() {
  var m = /id="mainPhoto".+?src="(.+?)"/.exec(responseText);
  var name = /id="mainPhoto".+?title="(.+?)"/.exec(responseText);
  if (name) {
    name = name[1].replace(/\?.*$/, "");
    if (!/\.[\w\d+]+$/.test(name)) {
      name += ".jpg";
    }
  }
  if (m && m.length >= 2) {
    setURL(m[1], name);
    finish();
    return;
  }

  // old school
  m = /lD\('(.*?)'\)/.exec(responseText);
  if (m && m.length >= 2) {
    setURL(lD(m[1]), name);
    finish();
    return;
  }
  if (/The image you are trying to access does not exist/.
      test(responseText)) {
    markGone(404, 'The image you are trying to access does not exist');
  }
  // nothing else helps :p
  finish();
}
doit();
