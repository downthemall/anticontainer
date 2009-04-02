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
 * The Original Code is DownThemAll! Anti-Container plugins module
 *
 * The Initial Developer of the Original Code is Nils Maier
 * Portions created by the Initial Developer are Copyright (C) 2009
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

const EXPORTED_SYMBOLS = ['enumerate'];

const Cc = Components.classes;
const Ci = Components.interfaces;

const Prefs = Cc['@mozilla.org/preferences-service;1']
	.getService(Ci.nsIPrefService)
	.getBranch('extensions.dta.anticontainer.');

const EMDirectory = Cc['@mozilla.org/extensions/manager;1']
	.getService(Ci.nsIExtensionManager)
	.getInstallLocation('anticontainer@downthemall.net')
	.getItemFile('anticontainer@downthemall.net', 'plugins/');

const PDirectory = Cc['@mozilla.org/file/directory_service;1']
	.getService(Ci.nsIProperties)
	.get("ProfD", Ci.nsILocalFile);

const JSON = Cc['@mozilla.org/dom/json;1'].createInstance(Ci.nsIJSON);

const FileInputStream = Components.Constructor('@mozilla.org/network/file-input-stream;1', 'nsIFileInputStream', 'init');

function _enumerate(enumerators, p) {
	for each (let [prio, e] in enumerators) {
		while (e.hasMoreElements()) {
			let f = e.getNext().QueryInterface(Ci.nsIFile);
			if (f.leafName.search(/\.json$/i) != -1) {
				try {
					let fs = new FileInputStream(f, 0x01, 0, 1<<2);
					let o = JSON.decodeFromStream(fs, f.fileSize);
					if (['redirector', 'resolver', 'sandbox'].indexOf(o.type) == -1) {
						throw new Error("Failed to load plugin: invalid type");
					}
					
					switch (o.type) {
					case 'resolver':
						if (!o.filter || !o.builder) {
							throw new Error("Failet to load plugin: incomplete resolver!");
						}
						break;
					case 'redirector':
						if (!o.pattern || !o.match) {
							throw new Error("Failet to load plugin: incomplete redirector!");
						}
						break;
					case 'sandbox':
						if (!o.process && !o.resolve) {
							throw new Error("Failet to load plugin: sandboxed plugin doesn't implement anything!");
						}
						break;
					}
					

					if (p.indexOf(o.prefix) != -1) {
						continue;
					}

					
					o.file = f;	
					for each (let x in ['match', 'finder', 'pattern']) {
						if (x in o) {
							o[x] = new RegExp(o[x], 'im');
						}
					}
					for each (let c in o.cleaners) {
						for each (let x in ['pattern']) {
							if (x in c) {
								c[x] = new RegExp(c[x], 'i');
							}
						}
					}
					if (!o.priority) {
						o.priority = 0;
					}
					o.priority += prio;
					yield o;
				}
				catch (ex) {
					Components.utils.reportError("Failed to load " + f.leafName);
					Components.utils.reportError(ex);
				}
			}
		}
	}
}

function enumerate(all) {
	let enums = [[1, EMDirectory.directoryEntries]];
	try {
		let pd = PDirectory.clone();
		pd.append('anticontainer_plugins');
		enums.push([3, pd.directoryEntries]);
	}
	catch (ex) {
		// no op
	}
	let g = _enumerate(enums, all ? [] : Prefs.getCharPref('disabled_plugins').split(';'));
	for (let e in g) {
		yield e;
	}
}