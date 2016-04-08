/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

"use strict";

var EXPORTED_SYMBOLS = ['privatizeXHR'];

const Ci = Components.interfaces;
const Cr = Components.results;
const Cu = Components.utils;

Cu.import("resource://gre/modules/XPCOMUtils.jsm");
Cu.import("resource://gre/modules/Services.jsm");

var privatizeXHR = (function() {
  function Callbacks(o) {
    this.callbacks = o.notificationCallbacks;
    if (this.callbacks) {
      o.notificationCallbacks = this;
    }
    o.loadGroup = null;
  }
  Callbacks.prototype = {
    QueryInterface: XPCOMUtils.generateQI([Ci.nsIInterfaceRequestor]),
    getInterface: function(iid) {
      if (!this.callbacks || iid.equals(Ci.nsILoadContext)) {
        throw Cr.NS_ERROR_NO_INTERFACE;
      }
      return this.callbacks.getInterface(iid);
    }
  };
  if (!("nsIPrivateBrowsingChannel" in Ci)) {
    return function() {};
  }
  return function privatizeXHR(req) {
    if (!(req.channel instanceof Ci.nsIPrivateBrowsingChannel)) {
      return;
    }
    new Callbacks(req.channel);
    req.channel.setPrivate(true);
  };
})();
