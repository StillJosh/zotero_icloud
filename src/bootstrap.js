// Code for starting the extension /Applications/Zotero.app/Contents/MacOS/zotero -purgecaches -ZoteroDebugText - jsconsole

var ICloudAttacher;

function log(msg) {
	Zotero.debug("ICloud Attacher: " + msg);
}

function install() {
	log("Installed 2.0");
}

async function startup({ id, version, rootURI }) {
	log("Starting 2.0");

	Zotero.PreferencePanes.register({
		pluginID: 'icloud-attacher@example.com',
		src: rootURI + 'preferences.xhtml',
		scripts: [rootURI + 'preferences.js']
	});

	Services.scriptloader.loadSubScript(rootURI + 'icloud-attacher.js');
	ICloudAttacher.init({ id, version, rootURI });
	ICloudAttacher.addToAllWindows();
	ICloudAttacher.readAllTagsFromICloud();
	await ICloudAttacher.main();
}

function onMainWindowLoad({ window }) {
	ICloudAttacher.addToWindow(window);
}

function onMainWindowUnload({ window }) {
	ICloudAttacher.removeFromWindow(window);
}

function shutdown() {
	log("Shutting down 2.0");
	ICloudAttacher.removeFromAllWindows();
	ICloudAttacher = undefined;
}

function uninstall() {
	log("Uninstalled 2.0");
}
