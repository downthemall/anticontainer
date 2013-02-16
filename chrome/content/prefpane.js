/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */


var acPlugins = (function() {
"use strict";

const _ = Components.utils.import("resource://dtaac/l10n.jsm", {}).bundle("prefpane.properties");

if (!("log" in window)) {
	window.LOG_DEBUG = window.LOG_ERROR = window.LOG_INFO = 0;
	window.log = (function() {
		let Logger = DTA.Logger;
		if (!Logger) {
			Logger = DTA.Debug;
		}
		return function(ll, msg, ex) {
			if (ex) {
				Logger.log(msg, ex);
			}
			else {
				Logger.log(msg);
			}
		};
	})();
}

var acPlugins = {
	_plugins: {},
	_prompts: {},
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
		try {
			this._prompts = require("prompts");
		}
		catch (ex) {
			Components.utils.import("resource://dta/prompts.jsm", this._prompts);
		}

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

		let id = this._list.selectedItem;
		if (id) {
			id = id.id;
		}
		while (this._list.childNodes.length) {
			this._list.removeChild(this._list.firstChild);
		}

		let p = [];
		try {
			p = JSON.parse(this._pref.value);
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
		}
		if (id) {
			this._list.selectedItem = $(id);
		}
		else {
			this._list.clearSelection();
		}
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
			log(LOG_ERROR, "Failed to get runtime", ex);
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
				log(LOG_ERROR, "Failed to launch editor", ex);
			}

			Preferences.setExt('anticontainer.namespace', p.ns);
			Preferences.setExt('anticontainer.author', p.author);
			this.showPluginList(plug.id);
		}
		catch (ex) {
			log(LOG_ERROR, "Failed to install plugin", ex)
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

return acPlugins;

})();

addEventListener('load', function() acPlugins.init(), true);
