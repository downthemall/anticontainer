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
	
	init: function acPL_init() {
		function zeropad (s, l) {
			s = s.toString(); // force it to a string
			while (s.length < l) {
				s = '0' + s;
			}
			return s;
		}
		
		this._pane = document.getElementById('acPane');
		this._pref = document.getElementById('acPrefPlugins');
		this._list = document.getElementById('acListPlugins');
		
		Components.utils.import('resource://dtaac/plugins.jsm', this._plugins);
		
		let p = this._pref.value.split(';');
		let plugs = [];			
		for (let f in this._plugins.enumerate(true)) {
			let date = new Date(f.file.lastModifiedTime);
			date = zeropad(date.getUTCFullYear(), 4)
             + "/" + zeropad(date.getUTCMonth() + 1, 2)
             + "/" + zeropad(date.getUTCDate(), 2);
			plugs.push([f.prefix, date , p.indexOf(f.prefix) != -1, f.priority, f.match, f.type, f.managed, f.file.path]);
		}
		plugs.sort(
			function(a,b) { return a[0] < b[0] ? -1 : (a[0] > b[0] ? 1 : 0);}
		);
		let i = 1;
		for each (let [p, date, disabled, prio, match, ptype, managed, file] in plugs) {
			let li = document.createElement('richlistitem');
			li.setAttribute('id', 'plugin_' + p);
			li.setAttribute('value', p);
			li.setAttribute('date', date);
			li.setAttribute('position', i + ".");
			li.setAttribute('priority', prio);
			li.setAttribute('match', match);
			li.setAttribute('ptype', ptype);
			li.setAttribute('activated', !disabled);
			li.setAttribute('managed', managed);
			li.setAttribute('file', file);
			this._list.appendChild(li);
			++i;
		};
		this._list.clearSelection();
		
		this.init = function() {};
	},

	syncFrom: function acPL_syncFrom() {
	},

	syncTo: function acPL_syncTo() {
		try	{
			let p = [];
			for (let i = 0; i < this._list.childNodes.length; ++i) {
				if (!this._list.childNodes[i].activated) {
					p.push(this._list.childNodes[i].getAttribute('value'));
				}
			}
			return p.join(';');
		}
		catch (ex) {
			alert(ex);
			throw ex;
		}
		return "";
	}
};
addEventListener('load', function() acPlugins.init(), true);