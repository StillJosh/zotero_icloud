ICloudAttacher = {
    id: null,
    version: null,
    rootURI: null,
    initialized: false,
    addedElementIDs: [],

    init({id, version, rootURI}) {
        if (this.initialized) return;
        this.id = id;
        this.version = version;
        this.rootURI = rootURI;
        this.initialized = true;

        let newItemNotifierID = Zotero.Notifier.registerObserver(this.newItemCallback, ['item']);

        Services.scriptloader.loadSubScript(this.rootURI + 'attacher_utils.js');
        Components.utils.import("resource://gre/modules/osfile.jsm");

    },

    /**
     * This function is triggered when a new item is added in Zotero.
     * It checks if the added item is a PDF attachment that is not linked.
     * If it is, it copies the file to the iCloud folder, retrieves the correct collection path,
     * and constructs the target file path.
     * It then attempts to copy the file to the target path.
     * If the copy is successful, it links the file to the item and deletes the original file.
     * If the file already exists at the target path, it links the existing file to the item and deletes the original file.
     * Finally, it adds an 'Unread' tag to the item and writes this tag to the iCloud file.
     */
    newItemCallback: {
        notify: function (event, type, ids) {

            // Import the OS.File module
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

                // Copy the file to the target path
                Zotero.icloudAttacher.copyFileToICloud(item, targetFile, parentItem);

                // If set in preferences, add 'Unread' tag to the item in Zotero and iCloud
                if (Zotero.Prefs.get('extensions.icloud-attacher.addUnreadTag', true)) {
                    Zotero.debug("Tag File: ");
                    // Add 'Unread' tag to the item
                    parentItem.setTags([{tag: 'unread', type: 1}]);
                    //Todo: Make this folder path relative
                    Zotero.icloudAttacher.writeTags(targetFile, ['unread']);
                }

            });
        }

    },

    /**
     * This function updates the tags of PDF attachments in iCloud according to the Zotero Tags.
     * It retrieves the active Zotero pane and the iCloud path from the preferences.
     * It then iterates over all items in the pane, and for each item, it gets its attachments.
     * For each attachment, if it is a PDF, it constructs the iCloud path for the attachment,
     * retrieves the tags of the item, and writes these tags to the iCloud file.
     */
    updateTagsFromZotero: function () {
        Zotero.debug("Updating tags from Zotero");

        // Get all items in the active Zotero pane (i.e. the currently open library and collection)
        const pane = Zotero.getActiveZoteroPane();
        let items = pane.getSortedItems();

        const iCloudPath = Zotero.Prefs.get('extensions.icloud-attacher.iCloudPath', true);
        // Iterate over all items in the pane
        for (let item in items) {

            // Get all attachments of the item and iterate over them
            let attachments = items[item].getAttachments();
            for (let a in attachments) {
                let attachment = Zotero.Items.get(attachments[a]);

                // If the attachment is a linked PDF, get its full path and write the tags to the file
                if (attachment.attachmentContentType === 'application/pdf') {
                    var it = OS.Path.join(iCloudPath,
                                            attachment.attachmentPath.replace(/^.*attachments:PaperLibrary\//, ''));
                    var tags = items[item].getTags();
                    tags = Object.values(tags).map(item => item.tag);
                    Zotero.icloudAttacher.writeTags(it, tags);
                }
            }
        }
    },

    log(msg) {
        Zotero.debug("ICloud Attacher: " + msg);
    },

    /**
     * This function adds a menu item to the view menu, which allows the user to update the tags of PDF attachments
     * in iCloud according to the Zotero tags.
     */
    addToWindow(window) {
        let doc = window.document;

        // Use Fluent for localization
        window.MozXULElement.insertFTLIfNeeded("icloud-attacher.ftl");

        // Add menu options to view menu for updating icloud tags
        let menuitemfromZotero = doc.createXULElement('menuitem');
        menuitemfromZotero.id = 'update-Tags-From-Zotero';
        menuitemfromZotero.setAttribute('type', 'normal');
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

    async main() {
        // Global properties are included automatically in Zotero 7
        var host = new URL('https://foo.com/path').host;
        this.log(`Host is ${host}`);

        // Retrieve a global pref
        this.log(`Intensity is ${Zotero.Prefs.get('extensions.make-it-red.intensity', true)}`);
    }

};

