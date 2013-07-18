# Developing AntiContainer

## Build Prerequisites

* Working [python](http://python.org/) with either json (2.7+) or simplejson installed
* Optionally xpisign.py 

## Development

1. Clone the repository
2. See [Setting up an extension development environment](https://developer.mozilla.org/en/Setting_up_extension_development_environment).
3. Create an extension proxy file as described in 2.
4. Create/update plugins.json: `cd build; python build_plugins.py`
5. Build an xpi: `build/make.py ac.xpi`


### Creating/Updating plugins
It is recommended to create and test plugins outside of `plugins/` first. This has the added benefit that changes will take by only closing and opening the Manager window as opposed to restarting the whole browser.
Once you're done move the new plugin .json to the plugins/ directory and update plugins.json as described above

Currently the documentation about plugins lives at [wiki/Writing plugins](https://github.com/downthemall/anticontainer/wiki/Writing-plugins).

### Adding features or developing fixes
If you'd like to add a new feature or develop a major fix, then please file an issue before.
This will ensure before you do all the work, that the feature or fix is something we're willing to pull later.

### Protip:
To forcefully reload the built-in plugins:

1. Set `nglayout.debug.disable_xul_cache` to true
2. Open the Error/Browser Console
3. Execute `Components.utils.unload("chrome://dtaac-modules/content/plugins.jsm")`
4. Re-open the manager window
