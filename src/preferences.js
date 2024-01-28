var FilePicker = require('zotero/filePicker').default;

var ICloudAttacher_Preferences = {
    init: function() {
        // Your initialization code goes here
    }
};

ICloudAttacher_Preferences.iCloud_Directory = {
    getPath: function () {
        var oldPath = Zotero.Prefs.get('extensions.icloud-attacher.iCloudPath', true);
        if (oldPath) {
            try {
                return OS.Path.normalize(oldPath);
            } catch (e) {
                Zotero.logError(e);
                return false;
            }
        }
    },


    choosePath: async function () {
        var oldPath = this.getPath();

        //Prompt user to choose new base path
        var fp = new FilePicker();
        if (oldPath) {
            fp.displayDirectory = oldPath;
        }
        fp.init(window, Zotero.getString('attachmentBasePath.selectDir'), fp.modeGetFolder);
        fp.appendFilters(fp.filterAll);
        if (await fp.show() != fp.returnOK) {
            return false;
        }
        var newPath = fp.file;

        if (oldPath && oldPath == newPath) {
            Zotero.debug("Base directory hasn't changed");
            return false;
        }

        try {
            Zotero.debug('Old path: ' + Zotero.Prefs.get('extensions.icloud-attacher.iCloudPath', true));
            Zotero.Prefs.set('extensions.icloud-attacher.iCloudPath', newPath, true);
            Zotero.debug('New path: ' + Zotero.Prefs.get('extensions.icloud-attacher.iCloudPath', true));
            return true;
        }
        catch (e) {
            Zotero.logError(e);
            Zotero.alert(null, Zotero.getString('general.error'), e.message);
        }

    },

};