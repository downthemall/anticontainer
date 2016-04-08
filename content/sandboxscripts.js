/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

"use strict";

/* globals log */
/* globals _outer_getToken, _outer_getProperty, _outer_setProperty */
/* globals _outer_setCallback, _outer_callFunction */

// The following utility code is evaluated in the Sandboxes of
// sandbox-type plugins.
// There is more in the Sandbox however; everything that needs access to the
// "outside" has to be implemented on the "outside".
// // Being evaluated in the Sandbox this code has no chrome privileges.

// to-outer stubs, so that .call works
function setURL(url, nameSuggestion) {
  /* globals _setURL */
  return _setURL(url, nameSuggestion);
}
function queueDownload(url, nameSuggestion) {
  /* globals _queueDownload */
  return _queueDownload(url, nameSuggestion);
}
function markGone(code, status) {
  /* globals _markGone */
  return _markGone(code, status);
}
function finish() {
  /* globals _finish */
  return _finish();
}
function process() {
  /* globals _process */
  return _process();
}
function resolve() {
  /* globals _resolve */
  return _resolve();
}
function defaultResolve() {
  /* globals _defaultResolve */
  return _defaultResolve();
}


function Request() {
  this._token = _outer_getToken('XMLHttpRequest');
}
Request.prototype = {
  get responseText() {
    return _outer_getProperty(this._token, "responseText");
  },
  set responseText(nv) {
    _outer_setProperty(this._token, "responseText", nv);
  },
  get status() {
    return _outer_getProperty(this._token, "status");
  },
  get statusText() {
    return _outer_getProperty(this._token, "statusText");
  },

  get onload() {
    throw new Error("not implemented");
  },
  set onload(callback) {
    _outer_setCallback(this._token, "onload", callback);
  },
  get onerror() {
    throw new Error("not implemented");
  },
  set onerror(callback) {
    _outer_setCallback(this._token, "onerror", callback);
  },

  abort: function() {
    return _outer_callFunction(this._token, "abort");
  },
  enableCookies: function() {
    return _outer_callFunction(this._token, "enableCookies");
  },
  setRequestHeader: function(header, value) {
    return _outer_callFunction(this._token, "setRequestHeader", header, value);
  },
  getResponseHeader: function(header) {
    return _outer_callFunction(this._token, "getResponseHeader", header);
  },
  open: function(method, url) {
    return _outer_callFunction(this._token, "open", method, url);
  },
  send: function(data) {
    return _outer_callFunction(this._token, "send", data);
  }
};


/**
 * Aliases Request
 *
 * There are some differences to the "regular" XMLHttpRequest, most importantly:
 *  - There is no onreadystatechange; use onload and onerror
 *  - There is no overrideMimeType or responseXML
 */
var XMLHttpRequest = Request;

/**
 * Easy access to Request.
 * Will set responseText accordingly, so that you don't need to care about this
 * in your load handler.
 *
 * makeRequest always enables Cookies, while Request does not.
 *
 * Example:
 * makeRequest(url, "alert('ok')", function(r) { alert("fail"); });
 * var o = {
 *  url: 'http://example.com',
 *  ok: function(r) { alert(this.url + "\n" + r.responseText); },
 *  fail: function(r) { alert(r.readyState == 4 ? r.statusText : "failed"); }
 * };
 * makeRequest(v, o.ok, o.fail, o);
 *
 * @param url (String) URL to load
 * @param load (Function,String) [optional] Callback for successful loads.
 *             Request is passed as only parameter
 * @param error (Function) [optional] Callback for unsuccessful loads.
 *              Request is passed as only parameter
 * @param tp (Object) [optional] Context (or this-pointer) to apply the
 *           Callbacks to
 * @return void
 */
function makeRequest(url, load, error, ctx) {
  var _r = new Request();
  _r.onload = function() {
    responseText = _r.responseText;
    if (load) {
      log("load is: " + load);
      load.call(ctx, _r);
    }
  };
  _r.onerror = function() {
    responseText = _r.responseText;
    if (error) {
      error.call(ctx, _r);
    }
  };
  _r.open("GET", url, true);
  _r.enableCookies();
  _r.send(null);
}

this.__defineGetter__('responseText', function() {
  /* global _get_responseText */
  return _get_responseText();
});
this.__defineSetter__('responseText', function(nv) {
  /* global _set_responseText */
  return _set_responseText(nv);
});

function dump() {
  for (var p in this) {
    try {
      if ('toSource' in this[p]) {
        log(p + ": " + this[p].toSource());
      }
      else {
        log(p + ": " + this[p]);
      }
    }
    catch (ex) {
      log(p);
    }
  }
}

// shim
this.__defineGetter__('add' + 'Download', () => queueDownload);

