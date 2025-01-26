Zotero.icloudAttacher = new function() {

    this.copyFileToICloud = function(item, targetFile, parentItem) {
        Zotero.debug("Copying file to iCloud folder: " + item.getFilePath() + " to link path " + targetFile);
        IOUtils.copy(item.getFilePath(), targetFile, {noOverwrite: true})
            .then(() => {
                // Link the file to the item
                Zotero.debug("The file has been copied to iCloud folder.");

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
                Zotero.debug("Copy Error: " + error);

                const parentItem = Zotero.Items.get(item.parentID);
                Zotero.Attachments.linkFromFile({
                    file: targetFile,
                    libraryID: parentItem.libraryID,
                    parentItemID: parentItem.id,
                });

                // Delete the original file
                item.eraseTx();
            });
    };


    this.writeTags = function(filename, tags) {
        const tag_dict = {
            "Unread": "Unread",
            "Awesome": "Awesome",
            "Good": "Good",
            "Medium": "Medium",
            "Bad or Irrelevant": "Bad or Irrelevant",
            "Must Read": "Must Read",
            "Should Read": "Should Read",
        }
        tags = tags.map(tag => tag_dict[tag]);
        const tagString = tags.map(tag => `<string>${tag}</string>`).join('');
        const plist = `<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd"><plist version="1.0"><array>${tagString}</array></plist>`;

        Zotero.debug('Updated Color')
        Zotero.debug(tags);
        Zotero.debug(tagString);
        var file = Components.classes["@mozilla.org/file/local;1"]
            .createInstance(Components.interfaces.nsIFile);
        file.initWithPath("/usr/bin/xattr");

        var process = Components.classes["@mozilla.org/process/util;1"]
            .createInstance(Components.interfaces.nsIProcess);
        process.init(file);

        var args = ['-w', 'com.apple.metadata:_kMDItemUserTags', plist, filename];
        process.run(true, args, args.length);
    }.bind(Zotero.icloudAttacher);

    this.readTags = async function (filename) {
        try {
            let result = await Zotero.Utilities.Internal.subprocess(
                '/usr/bin/mdls',
                ['-name', 'kMDItemUserTags', filename]
            );

            let match = result.match(/\(\s*([\s\S]*?)\)/);
            if (!match || !match[1]) {
                Zotero.debug("No tags found");
                return [];
            }

            let tags = match[1]
                .split(',')
                .map(tag => tag.trim())
                .filter(tag => tag.length > 0 && tag !== ')')
                .map(tag => tag.replace(/^"|"$/g, ''));

            Zotero.debug("Parsed tags: " + JSON.stringify(tags));
            Zotero.debug("Read Tags: " + tags);
            return tags;
        } catch (error) {
            Zotero.debug("Error reading tags: " + error);
            return [];
        }
    }

}
