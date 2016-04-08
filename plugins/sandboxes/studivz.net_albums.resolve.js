"use strict";
var reImages = /<a[^>]+href="(\/Photos\/View\/[^"]+)"/img;
var rePages = /<a href="[^"]+\/p\/(\d+)" class="pager" title="(\d+)"/ig;

var url = baseURL.match(
  /((http:\/\/(?:www\.)?(?:studi|mein|schueler)vz\.net)\/Photos\/Album\/[^\/]+\/[^\/]+)(?:\/p\/(\d+))?/i
);
var curPage = parseInt(url[3], 10) || 1;
var maxPage = curPage;
var loaded = 0;
var images = [];

// get maximum page
var match;
while ((match = rePages.exec(responseText))) {
  maxPage = Math.max(maxPage, match[2]);
}

function parsePage (page) {
  var req = new XMLHttpRequest();
  req.onload = function() {
    var m;
    while ((m = reImages.exec(req.responseText))) {
      images[page-1].push(url[2] + m[1]);
    }
    tryContinue();
  };
  req.onerror = function() {
    markGone();
    finish();
  };
  req.open('GET', url[1] + '/p/' + page);
  req.send();
}

function tryContinue () {
  if (++loaded < maxPage) {
    return;
  }
  for (var i = 0; i < maxPage; i++) {
    for (var url of images[i]) {
      queueDownload(url);
    }
  }
  setURL(null);
  finish();
}

for (var i = 1; i <= maxPage; i++) {
  images[i - 1] = [];
  if (i != curPage) {
    parsePage(i);
  }
  else {
    var m;
    while ((m = reImages.exec(responseText))) {
      images[i - 1].push(url[2] + m[1]);
    }
    tryContinue();
  }
}
