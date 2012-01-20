/* ***** BEGIN LICENSE BLOCK *****
 * Version: MPL 1.1/GPL 2.0/LGPL 2.1
 *
 * The contents of this file are subject to the Mozilla Public License Version
 * 1.1 (the "License"); you may not use this file except in compliance with
 * the License. You may obtain a copy of the License at
 * http://www.mozilla.org/MPL/
 *
 * Software distributed under the License is distributed on an "AS IS" basis,
 * WITHOUT WARRANTY OF ANY KIND, either express or implied. See the License
 * for the specific language governing rights and limitations under the
 * License.
 *
 * The Original Code is DownThemAll! Anti-Container sandbox factories module
 *
 * The Initial Developer of the Original Code is Nils Maier
 * Portions created by the Initial Developer are Copyright (C) 2011
 * the Initial Developer. All Rights Reserved.
 *
 * Contributor(s):
 *   Nils Maier <MaierMan@web.de>
 *
 * Alternatively, the contents of this file may be used under the terms of
 * either the GNU General Public License Version 2 or later (the "GPL"), or
 * the GNU Lesser General Public License Version 2.1 or later (the "LGPL"),
 * in which case the provisions of the GPL or the LGPL are applicable instead
 * of those above. If you wish to allow use of your version of this file only
 * under the terms of either the GPL or the LGPL, and not to allow others to
 * use your version of this file under the terms of the MPL, indicate your
 * decision by deleting the provisions above and replace them with the notice
 * and other provisions required by the GPL or the LGPL. If you do not delete
 * the provisions above, a recipient may use your version of this file under
 * the terms of any one of the MPL, the GPL or the LGPL.
 *
 * ***** END LICENSE BLOCK ***** */

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
