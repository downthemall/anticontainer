/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

"use strict";

const EXPORTED_SYMBOLS = ['SandboxScripts'];

if (!('XMLHttpRequest' in this)) {
	this.XMLHttpRequest = Components.Constructor("@mozilla.org/xmlextras/xmlhttprequest;1", "nsIXMLHttpRequest");
}
let r = new XMLHttpRequest();
// don't try to parse as XML
r.overrideMimeType('text/javascript');
r.open('GET', 'chrome://dtaac/content/sandboxscripts.js', false);
r.send(null);

const SandboxScripts = r.responseText;
