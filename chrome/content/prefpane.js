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
 * The Original Code is DownThemAll! Anti-Container.
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

var acPlugins = {
	_plugins: {},
	_init: false,
	_pending: false,
	FilePicker: Components.Constructor('@mozilla.org/filepicker;1', 'nsIFilePicker', 'init'),
	
	init: function acPL_init() {
		this._pane = document.getElementById('acPane');
		this._pref = document.getElementById('acPrefPlugins');
		this._list = document.getElementById('acListPlugins');
		
		Components.utils.import('resource://dtaac/plugins.jsm', this._plugins);

		this.reload();
		Preferences.makeObserver(this);
		Cc['@mozilla.org/observer-service;1'].getService(Ci.nsIObserverService).addObserver(this, this._plugins.TOPIC_PLUGINSCHANGED, true);
		this.init = function() {};
	},
	reload: function() {
		function zeropad (s, l) {
			s = s.toString(); // force it to a string
			while (s.length < l) {
				s = '0' + s;
			}
			return s;
		}
		
		while (this._list.childNodes.length) {
			this._list.removeChild(this._list.firstChild);
		}
		
		let p = eval(this._pref.value);
		let plugs = [];			
		for (let f in this._plugins.enumerate(true)) {
			let date = new Date(f.file.lastModifiedTime);
			date = zeropad(date.getUTCFullYear(), 4)
             + "/" + zeropad(date.getUTCMonth() + 1, 2)
             + "/" + zeropad(date.getUTCDate(), 2);
			plugs.push([f.prefix, f.id, date , p.indexOf(f.id) != -1, f.priority, f.match, f.type, f.managed, f.author]);
		}
		plugs.sort(
			function(a,b) { return a[0] < b[0] ? -1 : (a[0] > b[0] ? 1 : 0);}
		);
		let i = 1;
		for each (let [prefix, plugin, date, disabled, prio, match, ptype, managed, author] in plugs) {
			let li = document.createElement('richlistitem');
			if (!author) {
				author = _(managed ? 'ac-syspluginauthor' : 'ac-unkpluginauthor');
			}
			li.setAttribute('plugin', plugin);
			li.setAttribute('prefix', prefix);
			li.setAttribute('date', date);
			li.setAttribute('position', i + ".");
			li.setAttribute('priority', prio);
			li.setAttribute('match', match);
			li.setAttribute('ptype', ptype);
			li.setAttribute('author', author);
			li.setAttribute('activated', !disabled);
			li.setAttribute('managed', managed);
			this._list.appendChild(li);
			++i;
		};
		this._list.clearSelection();
	},
	install: function() {
		let fp = new this.FilePicker(window, _('ac-installplugintitle'), Ci.nsIFilePicker.modeOpen);
		fp.appendFilter('JSON Plugin', '*.json');
		fp.defaultExtension = "json";
		fp.filterIndex = 1;
		
		let rv = fp.show();
		if (rv == Ci.nsIFilePicker.returnOK) {
			let installed = this._plugins.installFromFile(fp.file);
			Prompts.alert(window, _('ac-installplugintitle'), _('ac-installpluginsuccess', [installed.prefix]));
		}
	},
	observe: function() {
		this.reload();
	},

	syncFrom: function acPL_syncFrom() {
	},
	syncTo: function acPL_syncTo() {
		try	{
			let p = [];
			for (let i = 0; i < this._list.childNodes.length; ++i) {
				if (!this._list.childNodes[i].activated) {
					p.push(this._list.childNodes[i].getAttribute('plugin'));
				}
			}
			return uneval(p);
		}
		catch (ex) {
			alert(ex);
			throw ex;
		}
		return "";
	}
};
addEventListener('load', function() acPlugins.init(), true);