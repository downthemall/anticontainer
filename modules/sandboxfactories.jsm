/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

"use strict";

const EXPORTED_SYMBOLS = ['XMLHttpRequest_WRAP'];

const Cc = Components.classes;
const Ci = Components.interfaces;
const Cr = Components.results;
const Cu = Components.utils;
const module = Cu.import;
const log = Cu.reportError;
const Exception = Components.Exception;

if (!('XMLHttpRequest' in this)) {
	this.XMLHttpRequest = Components.Constructor("@mozilla.org/xmlextras/xmlhttprequest;1", "nsIXMLHttpRequest");
}

function XMLHttpRequest_WRAP() {
	let tp = this;
	let xhrLoad, xhrError;
	this._xhr = new XMLHttpRequest();
	this._xhr.addEventListener("load", xhrLoad = (function() {
		tp._xhr.removeEventListener("load", xhrLoad, false);
		tp._xhr.removeEventListener("error", xhrError, false);
		if (tp._onload) {
			tp._onload.call(null);
		}
	}), false);
	this._xhr.addEventListener("error", xhrError = (function() {
		tp._xhr.removeEventListener("load", xhrLoad, false);
		tp._xhr.removeEventListener("error", xhrError, false);
		tp._xhr.removeEventListener("abort", xhrError, false);
		if (tp._onerror) {
			tp._onerror.call(null);
		}
	}), false);
	this._xhr.addEventListener("abort", xhrError, false);
}
XMLHttpRequest_WRAP.prototype = {
	_properties: ['responseText', 'status', 'statusText'],
	get responseText() this._xhr.responseText,
	set responseText(nv) this._xhr.responseText = nv,
	get status() this._xhr.status,
	get statusText() this._xhr.statusText,

	_callbacks: ['onload', 'onerror'],
	_onload: null,
	set onload(nv) this._onload = nv,
	_onerror: null,
	set onerror(nv) this._onerror = nv,

	_functions: ['abort', 'enableCookies', 'setRequestHeader', 'getResponseHeader', 'open', 'send'],
	abort: function() this._xhr.abort(),
	enableCookies: function() {
		if (this._xhr.channel && this._xhr.channel instanceof Ci.nsIHttpChannelInternal) {
			// not really third party, but as the orgin is chrome the channel considers us a third party
			this._xhr.channel.forceAllowThirdPartyCookie = true;
		}
	},
	setRequestHeader: function(header, value) {
		return this._xhr.setRequestHeader(header, value);
	},
	getResponseHeader: function(header) {
		if (/cookie/i.test(header)) {
			return null;
		}
		return this._xhr.getResponseHeader(header);
	},
	open: function(method, url) this._xhr.open(method, url),
	send: function() this._xhr.send(null, true)
};
