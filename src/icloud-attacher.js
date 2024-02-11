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

		let newItemNotifierID = Zotero.Notifier.registerObserver(this.newItemCallback, ['item']);

		// Unregister callback when the window closes (important to avoid a memory leak)
		//window.addEventListener('unload', function(e) {
		//	Zotero.Notifier.unregisterObserver(newItemNotifierID);
		//}, false);
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

	updateTagsFromICloud: function() {
		const pane = Zotero.getActiveZoteroPane();

		var items = pane.getSortedItems();
		for (item in items){
			attachments = items[item].getAttachments();
			for (a in attachments){
				attachment = Zotero.Items.get(attachments[a]);
				if (attachment.attachmentContentType === 'application/pdf'){
					Zotero.debug(attachment.attachmentPath)
				}
			}
		}
	},

	updateTagsFromZotero: function() {
		Zotero.debug("Updating tags from Zotero");
	},
	
	log(msg) {
		Zotero.debug("ICloud Attacher: " + msg);
	},

	addToWindow(window) {
		let doc = window.document;
		Zotero.debug("ADd to window: ");

		// Add menu option
		let menuitemfromicloud = doc.createXULElement('menuitem');
		menuitemfromicloud.id = 'updateTagsFromICloud';
		menuitemfromicloud.setAttribute('type', 'checkbox');
		menuitemfromicloud.setAttribute('data-l10n-id', 'update-Tags-From-iCloud');
		// MozMenuItem#checked is available in Zotero 7
		menuitemfromicloud.addEventListener('command', () => {
			ICloudAttacher.updateTagsFromICloud();
		});
		doc.getElementById('menu_viewPopup').appendChild(menuitemfromicloud);
		this.storeAddedElement(menuitemfromicloud);

		let menuitemfromZotero = doc.createXULElement('menuitem');
		menuitemfromZotero.id = 'updateTagsFromZotero';
		menuitemfromZotero.setAttribute('type', 'checkbox');
		menuitemfromZotero.setAttribute('data-l10n-id', 'update-Tags-From-Zotero');
		// MozMenuItem#checked is available in Zotero 7
		menuitemfromZotero.addEventListener('command', () => {
			ICloudAttacher.updateTagsFromZotero();
		});
		doc.getElementById('menu_viewPopup').appendChild(menuitemfromZotero);
		this.storeAddedElement(menuitemfromZotero);
	},

	addToAllWindows() {
		Zotero.debug("ADd to all window: ");

		var windows = Zotero.getMainWindows();
		for (let win of windows) {
			if (!win.ZoteroPane) continue;
			this.addToWindow(win);
		}
	},

	storeAddedElement(elem) {
		if (!elem.id) {
			throw new Error("Element must have an id");
		}
		this.addedElementIDs.push(elem.id);
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
