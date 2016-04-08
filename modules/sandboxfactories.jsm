/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

"use strict";

var EXPORTED_SYMBOLS = ['XMLHttpRequest_WRAP'];

const Cc = Components.classes;
const Ci = Components.interfaces;
const Cr = Components.results;
const Cu = Components.utils;
const Exception = Components.Exception;

const {privatizeXHR} = Cu.import("chrome://dtaac-modules/content/utils.jsm", {});

if (!('XMLHttpRequest' in this)) {
	this.XMLHttpRequest = Components.Constructor("@mozilla.org/xmlextras/xmlhttprequest;1", "nsIXMLHttpRequest");
}

function XMLHttpRequest_WRAP(download) {
	this._download = download;
	this._lastProgress = 0;
	let tp = this;

	this._xhr = new XMLHttpRequest();
	this._xhr.addEventListener("load", this._load = (function() {
		tp._kill();
		if (tp._onload) {
			tp._onload.call(null);
		}
	}), false);
	this._xhr.addEventListener("error", this._error = (function() {
		tp._kill();
		if (tp._onerror) {
			tp._onerror.call(null);
		}
	}), false);
	this._xhr.addEventListener("abort", this._error, false);
	this._xhr.addEventListener("progress", this._progress = (function(e) {
		if (!tp || !tp._download || !('loaded' in e) || !isFinite(e.loaded)) {
			return;
		}
		tp._download.otherBytes += e.loaded - tp._lastProgress;
		tp._lastProgress = e.loaded;
	}), false);
}
XMLHttpRequest_WRAP.prototype = {
	_properties: ['responseText', 'status', 'statusText'],
	get responseText() {
		return this._xhr.responseText
	},
	set responseText(nv) {
		this._xhr.responseText = nv
	},
	get status() {
		return this._xhr.status;
	},
	get statusText() {
		return this._xhr.statusText;
	},

	_callbacks: ['onload', 'onerror'],
	_onload: null,
	set onload(nv) {
		this._onload = nv;
	},
	_onerror: null,
	set onerror(nv) {
		this._onerror = nv;
	},

	_kill: function() {
		try {
			this._xhr.removeEventListener("load", this._load, false);
		} catch (ex) {}
		try {
			this._xhr.removeEventListener("error", this._error, false);
		} catch (ex) {}
		try {
			this._xhr.removeEventListener("abort", this._error, false);
		} catch (ex) {}
		try {
			this._xhr.removeEventListener("progress", this._progress, false);
		} catch (ex) {}
	},

	_functions: ['abort', 'enableCookies', 'setRequestHeader', 'getResponseHeader', 'open', 'send'],
	abort: function() {
		this._xhr.abort();
	},
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
	open: function(method, url) {
		let rv = this._xhr.open(method, url);
		if (this._download.isPrivate) {
			privatizeXHR(this._xhr);
		}
		return rv;
	},
	send: function(data) {
		return this._xhr.send(data, true);
	}
};
