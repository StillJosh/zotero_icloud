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

        // Register observer for modifications (including tag changes)
        let modifyNotifierID = Zotero.Notifier.registerObserver(this.tagChangeCallback, ['item']);

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
    customPathJoin: function (...paths) {
        return paths.join('/');
    },
    newItemCallback: {
        notify: function (event, type, ids) {

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
                const collectionID = parentItem.getCollections()[0];

                let coll = Zotero.Collections.get(collectionID)
                let collNames = [coll.name]
                while (coll._parentID !== false) {
                    coll = Zotero.Collections.get(coll._parentID);
                    collNames.unshift(coll.name);
                }

                Zotero.debug("Collection Names: " + collNames);
                const targetFile = ICloudAttacher.customPathJoin(iCloudPath, ...collNames, item.attachmentFilename);

                // Copy the file to the target path
                Zotero.icloudAttacher.copyFileToICloud(item, targetFile, parentItem);

                // If set in preferences, add 'Unread' tag to the item in Zotero and iCloud
                if (Zotero.Prefs.get('extensions.icloud-attacher.addUnreadTag', true)) {
                    Zotero.debug("Tag File: ");
                    // Add 'Unread' tag to the item
                    parentItem.setTags([{tag: 'Unread', type: 1}]);
                    //Todo: Make this folder path relative
                    Zotero.icloudAttacher.writeTags(targetFile, ['Unread']);
                }

            });
        }

    },

    tagChangeCallback: {
        async notify(event, type, ids) {
            // We are only interested in modifications to items
            if (event !== 'modify' || type !== 'item') return;

            for (let id of ids) {
                let item = Zotero.Items.get(id);
                // Skip if it's not a regular (parent) item. We only want tags on the parent, not attachments.
                if (!item.isRegularItem() || item.isAttachment()) continue;

                // Retrieve current tags on the parent item
                let tags = await item.getTags();
                tags = tags.map(t => t.tag);

                // Find the iCloud path from preferences
                const iCloudPath = Zotero.Prefs.get('extensions.icloud-attacher.iCloudPath', true);

                // For each PDF attachment, update the Finder tags on iCloud
                let attachments = item.getAttachments();
                for (let attID of attachments) {
                    let attachment = Zotero.Items.get(attID);
                    if (attachment && attachment.attachmentContentType === 'application/pdf') {
                        // Construct the target file path (adjust as needed for your directory structure)
                        let targetFile = ICloudAttacher.customPathJoin(
                            iCloudPath,
                            attachment.attachmentPath.replace(/^.*attachments:PaperLibrary\//, '')
                        );
                        Zotero.debug("Updating tags for iCloud file: " + targetFile);
                        Zotero.icloudAttacher.writeTags(targetFile, tags);
                    }
                }
            }
        }
    },

    async readAllTagsFromICloud() {

        Zotero.Items.getAll(1).then(items => {
            for (let item of items) {
                if (item.itemType != 'attachment') {
                    continue;
                }
                if (item.attachmentContentType != 'application/pdf') {
                    continue;
                }
                let filePath = item.getFilePath();

                IOUtils.exists(filePath).then(exists => {
                    if (!exists) {
                        return;
                    } else {

                        Zotero.debug("Reading iCloud tags from: " + filePath);
                        Zotero.icloudAttacher.readTags(filePath).then(icloudTags => {
                            Zotero.debug("iCloud tags retrieved: " + JSON.stringify(icloudTags));

                            let parentItem = Zotero.Items.get(item.parentID);

                            parentItem.setTags(icloudTags);
                            parentItem.saveTx();

                            Zotero.debug("Zotero tags updated from iCloud tags for item " + parentItem + ".");

                        });
                    }
                });
            }
        });

        Zotero.debug("Done applying tags to all items.");
    },

    async writeAllTagsToICloud() {

        Zotero.Items.getAll(1).then(items => {
                for (let item of items) {
                    if (item.itemType != 'attachment') {
                        continue;
                    }
                    if (item.attachmentContentType != 'application/pdf') {
                        continue;
                    }
                    let filePath = item.getFilePath();

                    IOUtils.exists(filePath).then(exists => {
                        if (!exists) {
                            return;
                        } else {
                            let tags = item.getTags();
                            Zotero.debug("Writing tags to iCloud: " + tags);
                            Zotero.icloudAttacher.writeTags(filePath, tags);
                        }
                    });
                }

            }
        );

        Zotero.debug("Done writing tags to all items.");
    },


        log(msg)
        {
            Zotero.debug("ICloud Attacher: " + msg);
        }
    ,

        /**
         * This function adds a menu item to the view menu, which allows the user to update the tags of PDF attachments
         * in iCloud according to the Zotero tags.
         */
        addToWindow(window)
        {
            let doc = window.document;

            // Use Fluent for localization
            window.MozXULElement.insertFTLIfNeeded("icloud-attacher.ftl");

            // Add menu options to view menu for updating Zotero tags
            let menuitemfromZotero = doc.createXULElement('menuitem');
            menuitemfromZotero.id = 'read-all-tags-from-icloud';
            menuitemfromZotero.setAttribute('type', 'normal');
            menuitemfromZotero.setAttribute('data-l10n-id', 'read-all-tags-from-icloud');
            // MozMenuItem#checked is available in Zotero 7
            menuitemfromZotero.addEventListener('command', () => {
                ICloudAttacher.readAllTagsFromICloud();
            });
            doc.getElementById('menu_viewPopup').appendChild(menuitemfromZotero);
            this.storeAddedElement(menuitemfromZotero);

            // Add menu options to view menu for updating icloud tags
            let menuitemtoZotero = doc.createXULElement('menuitem');
            menuitemtoZotero.id = 'write-all-tags-to-icloud';
            menuitemtoZotero.setAttribute('type', 'normal');
            menuitemtoZotero.setAttribute('data-l10n-id', 'write-all-tags-to-icloud');
            // MozMenuItem#checked is available in Zotero 7
            menuitemtoZotero.addEventListener('command', () => {
                ICloudAttacher.writeAllTagsToICloud();
            });
            doc.getElementById('menu_viewPopup').appendChild(menuitemtoZotero);
            this.storeAddedElement(menuitemtoZotero);

        }
    ,

        addToAllWindows()
        {
            Zotero.debug("ADd to all window: ");

            var windows = Zotero.getMainWindows();
            for (let win of windows) {
                if (!win.ZoteroPane) continue;
                this.addToWindow(win);
            }
        }
    ,

        storeAddedElement(elem)
        {
            if (!elem.id) {
                throw new Error("Element must have an id");
            }
            this.addedElementIDs.push(elem.id);
        }
    ,

        removeFromWindow(window)
        {
            var doc = window.document;
            // Remove all elements added to DOM
            for (let id of this.addedElementIDs) {
                doc.getElementById(id)?.remove();
            }
            doc.querySelector('[href="icloud-attacher.ftl"]').remove();
        }
    ,

        removeFromAllWindows()
        {
            var windows = Zotero.getMainWindows();
            for (let win of windows) {
                if (!win.ZoteroPane) continue;
                this.removeFromWindow(win);
            }
        }
    ,

        async
        main()
        {
            // Global properties are included automatically in Zotero 7
            var host = new URL('https://foo.com/path').host;
            this.log(`Host is ${host}`);

            // Retrieve a global pref
            this.log(`Intensity is ${Zotero.Prefs.get('extensions.make-it-red.intensity', true)}`);
        }

    };

