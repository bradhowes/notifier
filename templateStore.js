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

    findTemplates: function(eventId, registrations, callback) {
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

            var foundMap = {};
            for (var foundIndex in found) {
                var entity = found[foundIndex];
                var bits = self.getKeyBits(entity.RowKey);
                var routeName = bits[0];
                var templateVersion = bits[1];
                var templateLanguage = bits[2];
                var contract = bits[3];
                var key = self.makeKey(routeName, templateVersion, templateLanguage, contract);
                foundMap[key] = entity;
            }

            var matches = [];
            for (var registrationIndex in registrations) {
                var registration = registrations[registrationIndex];
                var templateVersion = registration.templateVersion;
                var templateLanguage = registration.templateLanguage;
                var contract = registration.contract;
                var routes = registration.routes;
                for (var routeIndex in routes) {
                    var route = routes[routeIndex];
                    var routeName = route.name;
                    var key = self.makeKey(routeName, templateVersion, templateLanguage, contract);
                    var match = foundMap[key];
                    if (match !== undefined) {

                        // Exact match
                        match = {
                            'contract': contract,
                            'path': route.path,
                            'template': match.Content
                        };
                        matches.push(match);
                        continue;
                    }

                    var pos = templateLanguage.indexOf('-');
                    if (pos > 0) {

                        // Strip off language specialization and search.
                        key = self.makeKey(routeName, templateVersion, templateLanguage.substr(0, pos), contract);
                        match = foundMap[key];
                        if (match !== undefined) {
                            match = {
                                'contract': contract,
                                'path': route.path,
                                'template': match.Content
                            };
                            matches.push(match);
                            continue;
                        }
                    }

                    if (templateLanguage.substr(0, pos) != 'en') {

                        // Try for default English match
                        key = self.makeKey(routeName, templateVersion, 'en', contract);
                        match = foundMap[key];
                        if (match !== undefined) {
                            match = {
                                'contract': contract,
                                'path': route.path,
                                'template': match.Content
                            };
                            matches.push(match);
                        }
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
            'RouteName': routeName.toString(),
            'TemplateVersion': templateVersion.toString(),
            'TemplateLanguage': templateLanguage.toString(),
            'Contract': contract.toString(),
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
    },

    getKeyBits: function(rowKey) {
        return rowKey.split('_');
    }
};
