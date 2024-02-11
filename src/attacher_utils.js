Zotero.icloudAttacher = new function() {

    this.readTags = function(filename) {
        var file = Components.classes["@mozilla.org/file/local;1"]
            .createInstance(Components.interfaces.nsIFile);
        file.initWithPath("/usr/bin/mdls");

        var process = Components.classes["@mozilla.org/process/util;1"]
            .createInstance(Components.interfaces.nsIProcess);
        process.init(file);

        var args = ['-raw', '-name', 'kMDItemUserTags', filename];
        process.run(true, args, args.length);
    }.bind(Zotero.icloudAttacher);

    this.writeTags = function(filename, tags) {
        const tag_dict = {
            "unread": "Unread",
            "blue": "blau",
        }

        tags = tags.map(tag => tag_dict[tag]);
        const tagString = tags.map(tag => `<string>${tag}</string>`).join('');
        const plist = `<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd"><plist version="1.0"><array>${tagString}</array></plist>`;

        var file = Components.classes["@mozilla.org/file/local;1"]
            .createInstance(Components.interfaces.nsIFile);
        file.initWithPath("/usr/bin/xattr");

        var process = Components.classes["@mozilla.org/process/util;1"]
            .createInstance(Components.interfaces.nsIProcess);
        process.init(file);

        var args = ['-w', 'com.apple.metadata:_kMDItemUserTags', plist, filename];
        process.run(true, args, args.length);
    }.bind(Zotero.icloudAttacher);
}
