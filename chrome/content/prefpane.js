var acPlugins = {
	_plugins: {},
	_init: false,
	_pending: false,
	
	init: function acPL_init() {
		this._pane = document.getElementById('acPane');
		this._pref = document.getElementById('acPrefPlugins');
		this._list = document.getElementById('acListPlugins');
		
		Components.utils.import('resource://dtaac/plugins.jsm', this._plugins);
		
		this.init = function() {};
	},

	syncFrom: function acPL_syncFrom() {
		if (this._pending) {
			return;
		}
		
		function zeropad (s, l) {
			s = s.toString(); // force it to a string
			while (s.length < l) {
				s = '0' + s;
			}
			return s;
		}	
		
		try	{
			this.init();
			
			while (this._list.firstChild) {
				this._list.removeChild(this._list.firstChild);
			}
			let p = this._pref.value.split(';');

			let plugs = [];			
			for (let f in this._plugins.enumerate(true)) {
				let date = new Date(f.file.lastModifiedTime);
				date = zeropad(date.getUTCFullYear(), 4)
                 + "/" + zeropad(date.getUTCMonth() + 1, 2)
                 + "/" + zeropad(date.getUTCDate(), 2);
				plugs.push([f.prefix, date , p.indexOf(f.prefix) != -1]);
			}
			plugs.sort(
				function(a,b) { return a[0] < b[0] ? -1 : (a[0] > b[0] ? 1 : 0);}
			);
			let i = 1;
			for each (let [p, date, disabled] in plugs) {
				let li = document.createElement('richlistitem');
				li.setAttribute('value', p);
				li.setAttribute('date', date);
				li.setAttribute('position', i + ".");
				li.setAttribute('type', 'checkbox');
				li.addEventListener('click', function() acPlugins.change(), true);
				if (disabled) {
					li.setAttribute('checked', 'true');
				}
				this._list.appendChild(li);
				++i;
			};
		}
		catch (ex) {
			alert(ex);
			throw ex;
		}
	},

	syncTo: function acPL_syncTo() {
		try	{
			this.init();

			let p = [];
			for (let i = 0; i < this._list.childNodes.length; ++i) {
				if (this._list.childNodes[i].checked) {
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
	},
	
	change: function acPL_change() {
		this._pending = true;
		this._pane.userChangedValue(this._list);
		this._pending = false;
	}
};