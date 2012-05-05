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

    locate: function(eventId, routeName, templateVersion, templateLanguage, contract, callback) {
        var self = this;
        var query = azure.TableQuery
            .select()
            .from(this.tableName)
            .where("PartitionKey eq ?", eventId.toString());

        this.store.queryEntities(query, function(err, found)
        {
            if (err) {
                callback(err, null);
                return;
            }
            else if (found.length === 0) {
                callback(null, found);
                return;
            }

            var keys = [];
            keys.push(self.makeKey(routeName, templateVersion, templateLanguage, contract));

            var pos = templateLanguage.indexOf('-');
            if (pos > 0) {
                keys.push(self.makeKey(routeName, templateVersion, templateLanguage.substr(0, pos), contract));
            }

            if (templateLanguage.substr(0, pos) != 'en') {
                keys.push(self.makeKey(routeName, templateVersion, 'en', contract));
            }

            var matches = [];
            for (var index in found) {
                var entity = found[index];
                var rowKey = entity.RowKey;
                for (var inner in keys) {
                    if (rowKey.indexOf(keys[inner]) == 0) {
                        matches.push(entity.Content);
                        break;
                    }
                }
            }
            callback(null, matches);
        });
    },

    addTemplate: function(eventId, notificationId, routeName, templateVersion, templateLanguage, contract, content,
                          callback) {
        var self = this;
        var rowKey = self.makeRowKey(notificationId, routeName, templateVersion, templateLanguage, contract);

        var templateEntity = {
            'PartitionKey': eventId.toString(),
            'RowKey': rowKey,
            'Contract': contract,
            'Content': content
        };

        self.store.updateEntity(self.tableName, templateEntity, function(err, tmp) {
            if (err !== null) {
                self.store.insertEntity(self.tableName, templateEntity, callback);
            }
            else {
                callback(err, tmp);
            }
        });
    },

    removeTemplate: function(eventId, notificationId, routeName, templateVersion, templateLanguage, contract,
                             callback) {
        var self = this;
        var rowKey = self.makeRowKey(notificationId, routeName, templateVersion, templateLanguage, contract);

        var templateEntity = {
            'PartitionKey': eventId.toString(),
            'RowKey': rowKey
        };
        self.store.deleteEntity(self.tableName, templateEntity, function(err, tmp) {
            console.log('err:', err, 'tmp:', tmp);
            callback(err, tmp);
        });
    },

    makeKey: function(routeName, templateVersion, templateLanguage, contract) {
        return routeName + '_' + templateVersion + '_' + templateLanguage + '_' + contract + '_';
    },

    makeRowKey: function(notificationId, routeName, templateVersion, templateLanguage, contract) {
        return this.makeKey(routeName, templateVersion, templateLanguage, contract) + notificationId.toString();
    }
};
