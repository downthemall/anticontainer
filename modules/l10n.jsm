/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */
"use strict";

var EXPORTED_SYMBOLS = ["bundle"];

const {classes: Cc, interfaces: Ci, utils: Cu} = Components;

Cu.import("resource://gre/modules/Services.jsm");

function bundle() {
  const _br = /%S/gi;
  const _repl = function() {
    return _params.shift();
  };
  var _params;

  let strings = {};
  for (let b of Array.slice(arguments)) {
    for (let p of
         ["chrome://dtaac/locale/", "chrome://dtaac-locale/content/"]) {
      let bundle = Services.strings.createBundle(p + b).getSimpleEnumeration();
      while (bundle.hasMoreElements()) {
        let prop = bundle.getNext().QueryInterface(Ci.nsIPropertyElement);
        let key = prop.key;
        if (key in strings) {
          continue;
        }
        strings[key] = prop.value;
      }
    }
  }

  return function(key, params) {
    if (!(key in strings)) {
      return "<error>";
    }
    if (!params) {
      return strings[key] || "";
    }
    let fmt = strings[key] || "";
    _params = params;
    try {
      fmt = fmt.replace(_br, _repl);
    }
    finally {
      _params = null;
    }
    return fmt;
  };
}
