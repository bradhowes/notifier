/**
 * @file
 * TemplateStore prototype definition.
 */

module.exports = TemplateStore;

var azure = require("azure");

/**
 * TemplateStore constructor.
 */
function TemplateStore(name, callback) {
    if (name === undefined)  name = 'templates';
    if (callback === undefined) callback = function (err) {
        if (err) console.log('createTableIfNotExists: name:', name, 'err:', err);
    };

    this.tableName = name;
    this.store = azure.createTableService();
    this.store.createTableIfNotExists(name, callback);
}

TemplateStore.prototype = {

    locate: function(eventId, routeName, tempVers, tempLang, callback) {
        var self = this;
        var query = azure.TableQuery
            .select()
            .from(this.tableName)
            .where("PartitionKey eq ?", eventId.toString());

        this.store.queryEntities(query, function(err, found) {
            if (err) {
                callback(err, null); return;
            }
            else if (found.length === 0) {
                callback(null, found); return;
            }

            var pat1 = self.makeRowKey(routeName, tempVers, tempLang);
            var pat2 = self.makeAltRowKey(routeName, tempVers, tempLang);
            if (pat1 == pat2) {
                pat2 = null;
            }

            var matches = [];
            for (var index in found) {
                var entity = found[index];
                var rowKey = entity.RowKey;
                if (rowKey.indexOf(pat1) >= 0) {
                    matches.push(entity.Content);
                }
                else if (pat2 !== null && rowKey.indexOf(pat2) >=0) {
                    matches.push(entity.Content);
                }
            }
            callback(null, matches);
        });
    },

    addTemplate: function(eventId, notificationId, routeName, tempVers,
                          tempLang, content, callback) {
        var self = this;
        var rowKey = self.makeRowKey(routeName, tempVers, tempLang);
        rowKey += notificationId;
        var entity = {
            'PartitionKey': eventId.toString(),
            'RowKey': rowKey,
            'Content': content
        };
        self.store.updateEntity(self.tableName, entity, function(err, tmp) {
            if (err !== null) {
                self.store.insertEntity(self.tableName, entity, callback);
            }
            else {
                callback(err, tmp);
            }
        });
    },

    removeTemplate: function(eventId, notificationId, routeName, tempVers,
        tempLang, callback) {
        var self = this;
        var rowKey = self.makeRowKey(routeName, tempVers, tempLang);
        rowKey += notificationId;
        var entity = {
            'PartitionKey': eventId.toString(),
            'RowKey': rowKey
        };
        self.store.deleteEntity(self.tableName, entity, function(err, tmp) {
            console.log('err:', err, 'tmp:', tmp);
            callback(err, tmp);
        });
    },

    makeRowKey: function(routeName, tempVers, tempLang) {
        return routeName + '_' + tempVers + '_' + tempLang + '_';
    },

    makeAltRowKey: function(routeName, tempVers, tempLang) {
        return routeName + '_' + tempVers + '_' + tempLang.split('-')[0] + '_';
    }
};
