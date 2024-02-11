ICloudAttacher = {
	id: null,
	version: null,
	rootURI: null,
	initialized: false,
	addedElementIDs: [],
	
	init({ id, version, rootURI }) {
		if (this.initialized) return;
		this.id = id;
		this.version = version;
		this.rootURI = rootURI;
		this.initialized = true;

		let notifierID = Zotero.Notifier.registerObserver(this.newItemCallback, ['item']);

		// Unregister callback when the window closes (important to avoid a memory leak)
		window.addEventListener('unload', function(e) {
			Zotero.Notifier.unregisterObserver(notifierID);
		}, false);
	},

	newItemCallback: {
		notify: function(event, type, ids) {

			// Import the OS.File module
			Components.utils.import("resource://gre/modules/osfile.jsm");
			Zotero.debug("Item added: " + event + ' ' + type + ' ' + ids);

			// Only act on item additions
			if (event !== 'add' || type !== 'item') return;

			Zotero.Items.get(ids).forEach(item => {
				Zotero.debug("Item Invest: " + item.itemType + ' ' + item.attachmentContentType + ' ' + item.attachmentLinkMode);

				// Only act on PDF attachments which are not linked
				if (item.itemType !== 'attachment' || item.attachmentContentType !== 'application/pdf' || item.attachmentLinkMode !== 1) return;
				Zotero.debug("Item checked: " + item);

				// Copy the file to the iCloud folder
				const iCloudPath = Zotero.Prefs.get('extensions.icloud-attacher.iCloudPath', true);

				// Get correct collection path
				const parentItem = Zotero.Items.get(item.parentID);
				const collections = parentItem.getCollections();
				const collectionNames = collections.map(id => Zotero.Collections.get(id).name);
				Zotero.debug("Collection Names: " + collectionNames);
				const targetFile = OS.Path.join(iCloudPath, ...collectionNames, item.attachmentFilename);

				OS.File.copy(item.getFilePath(), targetFile, {noOverwrite: true})
					.then(() => {
						// Link the file to the item
						Zotero.debug("The file has been copied to iCloud folder.");
						Zotero.debug("Target File: "  + targetFile);

						Zotero.Attachments.linkFromFile({
							file: targetFile,
							libraryID: parentItem.libraryID,
							parentItemID: parentItem.getID(),
						});

						// Delete the original file
						item.eraseTx();
					})
					.catch(error => {
							// If the file already exists, link it to the item
							Zotero.debug("File already exists.");
							Zotero.debug("Target File: "  + targetFile);

						const parentItem = Zotero.Items.get(item.parentID);
							Zotero.Attachments.linkFromFile({
								file: targetFile,
								libraryID: parentItem.libraryID,
								parentItemID: parentItem.id,
							});

							// Delete the original file
							item.eraseTx();
					});
				Zotero.debug("Tag File: ");

				// Add 'Unread' tag to the item
				parentItem.setTags( [{tag: 'unread', type: 1}]);
				Zotero.debug(" File tagged: " + this.rootURI + 'attacher_utils.js');

				Services.scriptloader.loadSubScript('placeholder');
				Zotero.debug("subscript loaded: ");

				Zotero.icloudAttacher.writeTags(targetFile, ['unread']);
				});
			}

	},
	
	log(msg) {
		Zotero.debug("ICloud Attacher: " + msg);
	},

	addToAllWindows() {
		var windows = Zotero.getMainWindows();
		for (let win of windows) {
			if (!win.ZoteroPane) continue;
			this.addToWindow(win);
		}
	},
	
	removeFromWindow(window) {
		var doc = window.document;
		// Remove all elements added to DOM
		for (let id of this.addedElementIDs) {
			doc.getElementById(id)?.remove();
		}
		doc.querySelector('[href="icloud-attacher.ftl"]').remove();
	},
	
	removeFromAllWindows() {
		var windows = Zotero.getMainWindows();
		for (let win of windows) {
			if (!win.ZoteroPane) continue;
			this.removeFromWindow(win);
		}
	},

};
