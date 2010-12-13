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
 * The Original Code is DownThemAll! Anti-Container URL composer module
 *
 * The Initial Developer of the Original Code is Nils Maier
 * Portions created by the Initial Developer are Copyright (C) 2010
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

const EXPORTED_SYMBOLS = ['composeURL'];

const Cc = Components.classes;
const Ci = Components.interfaces;
const Cr = Components.results;
const Cu = Components.utils;
const module = Cu.import;
const log = Cu.reportError;
const Exception = Components.Exception;

const _io = Cc["@mozilla.org/network/io-service;1"].getService(Ci.nsIIOService);
const _cleaner = /[^/]+$/;

function composeURL(base, rel) {
	let baseURI = _io.newURI(base, null, null);
	try {
		rel = rel.replace(/&amp;/, '&');
		rel = rel.replace(/&quot;/, '"');
		rel = rel.replace(/&nbsp;/, ' ');
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