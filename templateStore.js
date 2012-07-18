/**
 * @fileOverview Defines the TemplateStore prototype and its methods.
 */
module.exports = TemplateStore;

var azure = require("azure");

/**
 * Initializes a new TemplateStore object. A TemplateStore reads from and writes to an Azure table store.
 *
 * @class TemplateStore
 *
 * @param {String} name the name of the table store to use/create
 * @param {Function} callback the function to invoke when the table store exits
 */
function TemplateStore(name, callback) {
    this.log = require('./config.js').log('templateManager');

    if (name === undefined) {
        name = 'templates';
    }

    /**
     * Default callback function for new TemplateStore instances. Simply logs to the console any errors it sees.
     */
    function defaultCallback(err) {
        if (err) console.log('createTableIfNotExists: name:', name, 'err:', err);
    }

    if (callback === undefined) {
        callback = defaultCallback;
    }

    this.tableName = name;
    this.store = azure.createTableService();
    this.store.createTableIfNotExists(name, callback);
}

TemplateStore.prototype = {

    /**
     * Find templates that match the given parameters.
     */
    findTemplates: function(eventId, registrations, callback) {
        var self = this;
        var log = self.log.child('findTemplates');

        log.BEGIN(eventId, registrations);

        var query = azure.TableQuery
            .select()
            .from(this.tableName)
            .where("PartitionKey eq ?", eventId.toString());

        this.store.queryEntities(query, function(err, found)
        {
            if (err) {
                log.error('queryEntities error:', err);
                callback(err, null);
                return;
            }
            else if (found.length === 0) {
                log.info('queryEntities returned no entities');
                callback(null, found);
                log.END();
                return;
            }

            var foundMap = {};
            for (var foundIndex in found) {
                var entity = found[foundIndex];
                var bits = self.getKeyBits(entity.RowKey);
                var routeName = bits[0];
                var templateVersion = bits[1];
                var templateLanguage = bits[2];
                var service = bits[3];
                var key = self.makeKey(routeName, templateVersion, templateLanguage, service);
                foundMap[key] = entity;
            }

            var matches = [];
            for (var registrationIndex in registrations) {
                var registration = registrations[registrationIndex];
                var templateVersion = registration.templateVersion;
                var templateLanguage = registration.templateLanguage;
                var service = registration.service;
                var routes = registration.routes;
                for (var routeIndex in routes) {
                    var route = routes[routeIndex];
                    var routeName = route.name;
                    var key = self.makeKey(routeName, templateVersion, templateLanguage, service);

                    log.debug('looking for:', key);
                    var match = foundMap[key];
                    if (match !== undefined) {
                        match = {
                            'service': service,
                            'token': route.token,
                            'template': match.Content
                        };

                        log.debug('exact match:', match);
                        matches.push(match);
                        continue;
                    }

                    var pos = templateLanguage.indexOf('-');
                    if (pos > 0) {

                        // Strip off language specialization and search.
                        key = self.makeKey(routeName, templateVersion, templateLanguage.substr(0, pos), service);
                        log.debug('looking for:', key);
                        match = foundMap[key];
                        if (match !== undefined) {
                            match = {
                                'service': service,
                                'token': route.token,
                                'template': match.Content
                            };

                            log.debug('general language match:', match);
                            matches.push(match);
                            continue;
                        }
                    }

                    if (templateLanguage.substr(0, pos) != 'en') {

                        // Try for default English match
                        key = self.makeKey(routeName, templateVersion, 'en', service);
                        log.debug('looking for:', key);
                        match = foundMap[key];
                        if (match !== undefined) {
                            match = {
                                'service': service,
                                'token': route.token,
                                'template': match.Content
                            };

                            log.debug('en language match:', match);
                            matches.push(match);
                        }
                    }
                }
            }

            callback(null, matches);
            log.END();
        });
    },

    /**
     * Add a new template to the table store.
     */
    addTemplate: function(eventId, notificationId, routeName, templateVersion, templateLanguage, service, content,
                          callback) {
        var self = this;
        var log = self.log.child('addTemplate');

        log.BEGIN(eventId, notificationId, routeName, templateVersion, templateLanguage, service, content);

        var rowKey = self.makeRowKey(notificationId, routeName, templateVersion, templateLanguage, service);
        log.debug('rowKey:', rowKey);

        var templateEntity = {
            'PartitionKey': eventId.toString(),
            'RowKey': rowKey,
            'RouteName': routeName.toString(),
            'TemplateVersion': templateVersion.toString(),
            'TemplateLanguage': templateLanguage.toString(),
            'Service': service.toString(),
            'Content': content
        };

        self.store.updateEntity(self.tableName, templateEntity, function(err, tmp) {
            if (err !== null) {
                log.warn('TableService.updateEntity error:', err);
                self.store.insertEntity(self.tableName, templateEntity, callback);
            }
            else {
                callback(err, tmp);
            }
            log.END();
        });
    },

    /**
     * Remove a template from the table store.
     */
    removeTemplate: function(eventId, notificationId, routeName, templateVersion, templateLanguage, service,
                             callback) {
        var self = this;
        var log = self.log.child('removeTemplate');

        log.BEGIN(eventId, notificationId, routeName, templateVersion, templateLanguage, service);

        var rowKey = self.makeRowKey(notificationId, routeName, templateVersion, templateLanguage, service);
        log.debug('rowKey:', rowKey);

        var templateEntity = {
            'PartitionKey': eventId.toString(),
            'RowKey': rowKey
        };

        self.store.deleteEntity(self.tableName, templateEntity, function(err, tmp) {
            if (err) {
                log.error('TableStore.deleteEntity error:', err);
            }
            callback(err, tmp);
        });
    },

    /**
     * Make a template key
     */
    makeKey: function(routeName, templateVersion, templateLanguage, service) {
        return routeName + '_' + templateVersion + '_' + templateLanguage + '_' + service + '_';
    },

    /**
     * Make a table store row key
     */
    makeRowKey: function(notificationId, routeName, templateVersion, templateLanguage, service) {
        return this.makeKey(routeName, templateVersion, templateLanguage, service) + notificationId.toString();
    },

    /**
     * Convert a key into its individual components
     */
    getKeyBits: function(rowKey) {
        return rowKey.split('_');
    }
};
