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
