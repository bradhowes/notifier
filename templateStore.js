/**
 * @fileOverview Defines the TemplateStore prototype and its methods.
 */
module.exports = TemplateStore;

var azure = require('azure');
var config = require('./config');

/**
 * Initializes a new TemplateStore object. A TemplateStore reads from and writes to an Azure table store.
 *
 * @class TemplateStore
 *
 * @param {String} name the name of the table store to use/create
 * @param {Function} callback the function to invoke when the table store exits
 */
function TemplateStore(tableName, callback) {
    var log = this.log = config.log('TemplateStore');
    log.BEGIN(tableName);
    if (tableName === undefined) {
        tableName = config.registrations_table_name;
    }

    this.tableName = tableName;
    this.store = azure.createTableService();
    this.store.createTableIfNotExists(tableName, function (err, b, c) {
                                          log.END(err, b, c);
                                          if (callback) callback(err);
                                      });

    this.findKeyGenerators = [this.makeKey.bind(this),
                              this.makeBaseLanguageKey.bind(this),
                              this.makeDefaultLanguageKey.bind(this) ];
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
            .where('PartitionKey eq ?', this.makePartitionKey(eventId.toString()));

        this.store.queryEntities(query, function(err, found)
        {
            var entity, bits, routeName, templateVersion, templateLanguage,
                service, key, matches, routes, routeIndex, route;
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
                log.debug('found:', found);
                entity = found[foundIndex];
                key = self.makeKey(entity.Route, entity.TemplateVersion, entity.TemplateLanguage, entity.Service);
                bits = foundMap[key];
                if (! bits) {
                    bits = [];
                    foundMap[key] = bits;
                }
                bits.push(entity);
            }

            matches = [];
            for (var registrationIndex in registrations) {
                var registration = registrations[registrationIndex];
                templateVersion = registration.templateVersion;
                templateLanguage = registration.templateLanguage;
                service = registration.service;
                routes = registration.routes;
                for (routeIndex in routes) {
                    route = routes[routeIndex];
                    routeName = route.name;
                    for (var genIndex in self.findKeyGenerators) {
                        key = self.findKeyGenerators[genIndex](routeName, templateVersion, templateLanguage,
                                                               service);
                        log.debug('looking for key:', key);
                        if (key === null) {
                            continue;
                        }

                        var matched = foundMap[key];
                        if (matched !== undefined) {
                            for (var matchIndex in matched) {
                                var template = null;
                                try {
                                    template = JSON.parse(matched[matchIndex].Content);
                                } catch (err) {
                                    log.error('failed to parse template:', matched[matchIndex].Content);
                                }

                                if (template !== null) {
                                    var match = {
                                        'service': service,
                                        'token': route.token,
                                        'template': JSON.parse(matched[matchIndex].Content)
                                    };
                                    log.debug('found match:', match);
                                    matches.push(match);
                                }
                            }
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
    addTemplate: function(params, callback) {
        var self = this;
        var log = self.log.child('addTemplate');
        log.BEGIN(params);

        var partitionKey = self.makePartitionKey(params.eventId.toString());
        log.debug('partitionKey:', partitionKey);

        var rowKey = self.makeRowKey(params.notificationId, params.route, params.templateVersion,
                                     params.templateLanguage, params.service);
        log.debug('rowKey:', rowKey);

        var templateEntity = {
            'PartitionKey': partitionKey,
            'RowKey': rowKey,
            'Route': params.route.toString(),
            'TemplateVersion': params.templateVersion.toString(),
            'TemplateLanguage': params.templateLanguage.toString(),
            'Service': params.service.toString(),
            'Content': JSON.stringify(params.template)
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
    removeTemplate: function(params, callback) {
        var self = this;
        var log = self.log.child('removeTemplate');
        log.BEGIN(params);

        var partitionKey = self.makePartitionKey(params.eventId.toString());
        log.debug('partitionKey:', partitionKey);

        var rowKey = self.makeRowKey(params.notificationId, params.route, params.templateVersion,
                                     params.templateLanguage, params.service);
        log.debug('rowKey:', rowKey);

        var templateEntity = {
            'PartitionKey': partitionKey,
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
     * Make a base-language template key
     */
    makeBaseLanguageKey: function(routeName, templateVersion, templateLanguage, service) {
        var pos = templateLanguage.indexOf('-');
        if (pos > 0) {
            return this.makeKey(routeName, templateVersion, templateLanguage.substr(0, pos), service);
        }
        return null;
    },

    /**
     * Make a base-language template key
     */
    makeDefaultLanguageKey: function(routeName, templateVersion, templateLanguage, service) {
        if (templateLanguage.substr(0, 2) !== 'en'){
            return this.makeKey(routeName, templateVersion, 'en', service);
        }
        return null;
    },

    /**
     * Make a table store partition key.
     */
    makePartitionKey: function(value) {
        return new Buffer(value).toString('base64');
    },

    /**
     * Make a table store row key
     */
    makeRowKey: function(notificationId, routeName, templateVersion, templateLanguage, service) {
        return new Buffer(this.makeKey(routeName, templateVersion, templateLanguage, service) +
                          notificationId.toString()).toString('base64');
    },

    /**
     * Convert a key into its individual components
     */
    getKeyBits: function(rowKey) {
        return rowKey.split('_');
    }
};
