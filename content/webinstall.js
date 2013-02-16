"use strict";

let plug = null;
let plugins = {};

function $(id) {
	return document.getElementById(id);
}

function load() {
	removeEventListener("load", load, true);
	Components.utils.import('chrome://dtaac-modules/content/plugins.jsm', plugins);

	let toHide = $('error');
	try {
		plug = plugins.popPlugin(location);
		if (typeof plug == 'string') {
			throw plug;
		}

		$('prefix').textContent = plug.prefix;
		$('match').textContent = plug.match;
		if (plug.author) {
			$('author').textContent = plug.author;
		}

		switch (plug.type) {
		case 'resolver':
			$('type').textContent = document.body.dataset.resolver;
			break;
		case 'redirector':
			$('type').textContent = document.body.dataset.redirector;
			break;
		case 'sandbox':
			$('type').textContent = document.body.dataset.sandbox;
			break;
		case 'expander':
			$('type').textContent = document.body.dataset.expander;
			break;
		default:
			$('type').textContent = document.body.dataset.unspecified;
			break;
		}

		$('code').textContent = plugins.prettyJSON(plug.source);
	}
	catch (ex) {
		$('errmsg').textContent = ex;
		toHide = $('plugin');
	}

	toHide.style.display = 'none';
}

function install() {
	$('install').setAttribute('disabled', 'true');
	$('cancel').textContent = $('back').textContent;
	plugins.installFromWeb(plug.source, location.toString());
	alert(document.body.dataset.success);
}
function showSource() {
	$('source').style.display = 'block';
	$('showsource').style.display = 'none';
}
function back() {
	try {
		history.previous && history.go(-1);
	}
	catch (ex) {
		location = 'http://downthemall.net/';
	}
}
function openPrefs() {
	try {
		try {
			let _m = Components.utils.import("chrome://dta-modules/content/glue.jsm", {}).require("support/mediator");
			_m.showPreferences(window, 'acPane');
		}
		catch (ex) {
			let _m = {};
			Components.utils.import("resource://dta/support/mediator.jsm", _m);
			_m.showPreferences(window, 'acPane');
		}
	}
	catch (ex) {
		alert("Failed to load mediator; update DTA");
	}
}
addEventListener("load", load, true);
