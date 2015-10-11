/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

"use strict";

var EXPORTED_SYMBOLS = ['composeURL'];

const Cc = Components.classes;
const Ci = Components.interfaces;
const Cr = Components.results;
const Cu = Components.utils;
const Exception = Components.Exception;

const _io = Cc["@mozilla.org/network/io-service;1"].getService(Ci.nsIIOService);
const _cleaner = /[^/]+$/;

function composeURL(base, rel) {
	let baseURI = _io.newURI(base, null, null);
	try {
		rel = rel.replace(/&amp;/g, '&');
		rel = rel.replace(/&quot;/g, '"');
		rel = rel.replace(/&nbsp;/g, ' ');
	}
	catch (ex) { /* no-op */ }

	let realURI = _io.newURI(rel, null, baseURI);
	let copy = realURI.clone().QueryInterface(Ci.nsIURL);
	copy.query = copy.ref = '';
	let newName = copy.path;
	let m = newName.match(_cleaner);
	if (m && m.length == 1) {
		newName = m[0];
	}
	return {
		base: baseURI,
		url: realURI,
		name: newName
		};
}
