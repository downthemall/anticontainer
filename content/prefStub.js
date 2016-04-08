/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

"use strict";

/* globals openURL */

function open_dta() {
  try {
    // contentAreaUtils
    openURL(document.getElementById('url').value);
  }
  catch (ex) {
    window.open(document.getElementById('url').value);
  }

  close();
}

try {
  try {
    let _m = Components.utils.import(
      "chrome://dta-modules/content/glue.jsm", {}).require("support/mediator");
    _m.showPreferences(window.opener, 'acPane');
  }
  catch (ex) {
    let _m = {};
    Components.utils.import("resource://dta/support/mediator.jsm", _m);
    _m.showPreferences(window.opener, 'acPane');
  }

  close();
}
catch (ex) {
  document.getElementById('mainbox').hidden = false;
}
