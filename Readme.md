# Developing AntiContainer

## Build Prerequisites

* Working [python](http://python.org/) with either json (2.7+) or simplejson installed
* [Apache Ant](http://ant.apache.org/) for XPI builds (optional, not required if you only want to develop AntiContainer)
* Mozilla nss signtool for signed builds (optional, required only if you want to make signed releases)

## Development

1. Clone the repository
2. See [Setting up an extension development environment](https://developer.mozilla.org/en/Setting_up_extension_development_environment).
3. Create an extension proxy file as described in 2.
4. Create/update plugins.json: `cd build; python combine.py`

### Creating/Updating plugins
It is recommended to create and test plugins outside of `plugins/` first. This has the added benefit that changes will take by only closing and opening the Manager window as opposed to restarting the whole browser.
Once you're done move the new plugin .json to the plugins/ directory and update plugins.json as described above

Currently the documentation about plugins lives at (https://bugs.downthemall.net/wiki/AntiContainer/WritingPlugins).

### Adding features or developing fixes
If you'd like to add a new feature or develop a major fix, then please file an issue before.
This will ensure before you do all the work, that the feature or fix is something we're willing to pull later.
