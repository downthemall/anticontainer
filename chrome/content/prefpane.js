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

"use strict";

if (!('Logger' in this)) {
	this['Logger'] = DTA.Debug;
}

var acPlugins = {
	_plugins: {},
	_init: false,
	_pending: false,
	FilePicker: Components.Constructor('@mozilla.org/filepicker;1', 'nsIFilePicker', 'init'),
	LocalFile: Components.Constructor('@mozilla.org/file/local;1', 'nsILocalFile', 'initWithPath'),
	Process: Components.Constructor('@mozilla.org/process/util;1', 'nsIProcess', 'init'),

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

		let p = [];
		try {
			p = JSON.stringify(this._pref.value);
		}
		catch (ex) { /* no op */ }

		if (!(p instanceof Array)) {
			p = [];
		}
		let plugs = [];
		for (let f in this._plugins.enumerate(true)) {
			let date = new Date(f.date);
			date = zeropad(date.getUTCFullYear(), 4)
             + "/" + zeropad(date.getUTCMonth() + 1, 2)
             + "/" + zeropad(date.getUTCDate(), 2);
			plugs.push([f.prefix, f.id, date , p.indexOf(f.id) != -1, f.priority, f.match, f.type, f.managed, f.author, f.file ? f.file.path : null, f.source]);
		}
		plugs.forEach(function(e) e.pl = e[0].toLowerCase());
		plugs.sort(function(a,b) a.pl < b.pl ? -1 : (a.pl > b.pl ? 1 : 0));
		let i = 1;
		for each (let [prefix, plugin, date, disabled, prio, match, ptype, managed, author, file, source] in plugs) {
			let li = document.createElement('richlistitem');
			if (!author) {
				author = _(managed ? 'ac-syspluginauthor' : 'ac-unkpluginauthor');
			}
			li.setAttribute('id', 'acplugin_' + plugin);
			li.setAttribute('plugin', plugin);
			li.setAttribute('prefix', prefix);
			li.setAttribute('searchlabel', prefix);
			li.setAttribute('date', date);
			li.setAttribute('position', i + ".");
			li.setAttribute('priority', prio);
			li.setAttribute('match', match);
			li.setAttribute('ptype', ptype);
			li.setAttribute('author', author);
			li.setAttribute('activated', !disabled);
			li.setAttribute('managed', managed);
			li.setAttribute('file', file);
			li.setAttribute('source', source);
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
	showNewPlugin: function() {
		this.np_clearErrors();

		$('acNPprefix', 'acNPmatch').forEach(function(e) e.value = '');
		$('acNPns').value = Preferences.getExt('anticontainer.namespace', '');
		$('acNPauthor').value = Preferences.getExt('anticontainer.author', '');

		if (!$('acNPns').value) {
			$('acNPns').value = this._plugins.DEFAULT_NAMESPACE;
		}

		$('acPluginsDeck').selectedIndex = 1;
	},
	showPluginList: function(id) {
		if (id) {
			let p = $('acplugin_' + id);
			if (p) {
				this._list.selectedItem = p;
				this._list.ensureElementIsVisible(p);
			}
		}
		$('acPluginsDeck').selectedIndex = 0;
	},
	get editor() {
		let _ed = Preferences.getExt('anticontainer.editor', '');
		if (_ed && !(new this.LocalFile(_ed)).isExecutable()) {
			_ed = '';
		}
		let fp = null;
		while (!_ed) {
			if (!fp) {
				fp = new this.FilePicker(window, _('ac-chooseeditortitle'), Ci.nsIFilePicker.modeOpen);
				fp.appendFilters(Ci.nsIFilePicker.filterApps);
				fp.appendFilters(Ci.nsIFilePicker.filterAll);
				let ds = Cc['@mozilla.org/file/directory_service;1']
		    		.getService(Ci.nsIProperties);
				for each (let d in ['ProgF', 'LocApp', 'CurProcD']) {
					try {
						fp.displayDirectory = ds.get("ProgF", Ci.nsILocalFile);
						break;
					}
					catch (ex) {
						// no op
					}
				}
			}
			let rv = fp.show();
			if (rv == Ci.nsIFilePicker.returnOK) {
				let f = fp.file;
				if (f.isSymlink()) {
					try {
						f = new this.LocalFile(f.target);
					}
					catch (ex) {
						// no op
					}
				}
				if (!f.isExecutable()) {
					alert(_('ac-editornotexec'));
					continue;
				}
				_ed = f.path;
				Preferences.setExt('anticontainer.editor', _ed);
				break;
			}
			// nothing selected;
			return null;
		}

		_ed = new this.LocalFile(_ed);
		_ed.followLinks = true;
		if (!_ed.exists() || !_ed.isExecutable()) {
			Preferences.setExt('anticontainer.editor', '');
			return this.editor; // recursive
		}
		return _ed;
	},
	showInEditor: function(file) {
		let ed = this.editor;
		if (!ed) {
			return;
		}
		if (typeof file == 'string') {
			file = new this.LocalFile(file);
		}
		if (!file) {
			throw new Error("invalid file specified");
		}
		if (!file.exists()) {
			throw new Error("File does not exist");
		}
		// credit to greasemonkey for this
		let args = [file.path];
		try {
			let rt = Cc['@mozilla.org/xre/app-info;1'].getService(Ci.nsIXULRuntime);
			if (rt.OS.match(/Darwin/)) {
				args = ['-a', ed.path, file.path];
				ed = new this.LocalFile('/usr/bin/open');
				ed.followLinks = true;
			}
		}
		catch (ex) {
			Logger.log("Failed to get runtime", ex);
		}
		try {
			let process = new this.Process(ed);
			process.run(false, args, args.length);
		}
		catch (ex) {
			Preferences.setExt('anticontainer.editor', '');
			this.showInEditor(file); // recursive
		}
	},
	np_showError: function(err) {
		let nb = $('acNPErrors');
		nb.appendNotification(err, null, null, nb.PRIORITY_CRITICAL_MEDIUM, null);
	},
	np_clearErrors: function(err) $('acNPErrors').removeAllNotifications(true),

	createNewPlugin: function() {
		let p = {};
		let errs = 0;

		this.np_clearErrors();

		for each (let e in $('acNPtype', 'acNPns', 'acNPauthor', 'acNPprefix', 'acNPmatch', 'acNPstatic')) {
			let n = e.id.substr(4);
			if (!(p[n] = e.value)) {
				this.np_showError(_('ac-npnotset', [$(e.id + 'Label').value]));
				++errs;
			}
		}
		if (p.match) {
			try {
				new RegExp(p.match);
			}
			catch (ex) {
				this.np_showError(_('ac-matchnotregex'));
				++errs;
			}
		}
		p.static = p.static == 'true';

		if (errs) {
			return;
		}

		try {
			let plug = this._plugins.createNewPlugin(p);

			try {
				this.showInEditor(plug.file);
			}
			catch (ex) {
				Logger.log("Failed to launch editor", ex);
			}

			Preferences.setExt('anticontainer.namespace', p.ns);
			Preferences.setExt('anticontainer.author', p.author);
			this.showPluginList(plug.id);
		}
		catch (ex) {
			Logger.log("Failed to install plugin", ex)
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
			return JSON.stringify(p);
		}
		catch (ex) {
			alert(ex);
			throw ex;
		}
		return "";
	}
};
addEventListener('load', function() acPlugins.init(), true);
