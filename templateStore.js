/**
 * @fileOverview Defines the TemplateStore prototype and its methods.
 */
module.exports = TemplateStore;

var azure = require('azure');
var config = require('./config');
var Q = require('q');
var TemplateCache = require('./templateCache');

/**
 * Initializes a new TemplateStore object. A TemplateStore reads from and writes to an Azure table store.
 *
 * @class TemplateStore
 *
 * @param {String} name the name of the table store to use/create
 * @param {Function} callback the function to invoke when the table store exits
 */
function TemplateStore(tableName, callback) {
    var self = this;
    var log = this.log = config.log('TemplateStore');
    log.BEGIN(tableName);
    if (tableName === undefined) {
        tableName = config.registrations_table_name;
    }

    this.tableName = tableName;
    this.store = azure.createTableService();
    this.cache = new TemplateCache();
    this.pendingGet = {};

    var checkCreateTableIfNotExists = function(err, b, c) {
        if (err) {
            log.error(err);
            if (err.statusCode === 409) {
                Q.delay(1000)   // Wait for one second and try again.
                    .then(function () {
                        self.store.createTableIfNotExists(tableName, checkCreateTableIfNotExists);
                    });
                return;
            }
        }

        log.END(err, b, c);
        if (callback) callback(err);
    };

    this.store.createTableIfNotExists(tableName, checkCreateTableIfNotExists);
    log.END();
}

TemplateStore.prototype = {

    /**
     * Find templates in the internal cache that match the given parameters.
     */
    find: function(eventId, registrations, callback) {
        var self = this;
        var log = self.log.child('find');
        log.BEGIN(eventId, registrations);

        var found = this.cache.get(eventId, registrations);
        if (typeof found === 'undefined') {
            var key = eventId.toString();
            var pending = this.pendingGet[key];
            if (typeof pending !== 'undefined') {
                pending.push([registrations, callback]);
                return;
            }

            pending = [];
            pending.push([registrations, callback]);
            this.pendingGet[key] = pending;

            self.get(eventId, function (err, found) {
                if (err) {
                    log.error('failed to fetch templates:', err);
                }
                else {
                    self.cache.set(eventId, found);
                }

                pending = self.pendingGet[key];
                delete self.pendingGet[key];

                // Visit all of the outstanding requests for these templates and invoke their callback.
                for (var index in pending) {
                    if (err) {
                        pending[index][1](err, null);
                    }
                    else {
                        self.find(eventId, pending[index][0], pending[index][1]);
                    }
                }
            });
            return;
        }

        callback(null, found);
        log.END();
    },

    /**
     * Get all templates associated with a given eventId.
     *
     * @param {Integer} eventId the eventId to look for
     *
     * @param {Function} callback the function to invoke when the query is done
     *
     * @return {Object} results of the query, with templates grouped by their notificationId values
     */
    get: function(eventId, callback) {
        var self = this;
        var log = self.log.child('get');
        log.BEGIN(eventId);
        var partitionKey = this.makePartitionKey(eventId);
        var query = azure.TableQuery.select()
                                    .from(this.tableName)
                                    .where('PartitionKey eq ?', partitionKey);
        this.store.queryEntities(query, function(err, found) {
            var entities, entity, key, keys, foundIndex, genIndex;
            if (err) {
                log.error('queryEntities error:', err);
                callback(err, null);
                return;
            }

            for (foundIndex in found) {
                log.debug('found:', found);
                entity = found[foundIndex];
                var notificationId = entity.NotificationId;
                if (typeof notificationId === 'undefined') {
                    notificationId = Buffer(entity.RowKey, 'base64').toString().split('_').pop();
                    entity.NotificationId = notificationId;
                }
            }

            callback(null, found);
        });
    },

    /**
     * Add a new template to the table store.
     */
    add: function(params, callback) {
        var self = this;
        var log = self.log.child('add');
        log.BEGIN(params);

        var partitionKey = self.makePartitionKey(params.eventId);
        log.debug('partitionKey:', partitionKey);

        var rowKey = self.makeRowKey(params.notificationId, params.route, params.templateVersion,
                                     params.templateLanguage, params.service);
        log.debug('rowKey:', rowKey);

        var entity = {
            'PartitionKey': partitionKey,
            'RowKey': rowKey,
            'NotificationId': params.notificationId.toString(),
            'Route': params.route.toString(),
            'TemplateVersion': params.templateVersion.toString(),
            'TemplateLanguage': params.templateLanguage.toString(),
            'Service': params.service.toString(),
            'Content': JSON.stringify(params.template)
        };

        log.debug('entity:', entity);

        self.store.updateEntity(self.tableName, entity, function(err, tmp) {
            log.debug('updateEntity err:', err, 'tmp:', tmp);
            if (err !== null) {
                log.debug('attempting to insert:', entity);
                self.store.insertEntity(self.tableName, entity, function (err, tmp) {
                    log.debug('insertEntity err: ', err, ' tmp: ', tmp);
                    if (err === null) {
                        self.cache.add(params.eventId, entity);
                    }
                    callback(err, tmp);
                    log.END();
                });
            }
            else {
                self.cache.add(params.eventId, entity);
                callback(err, tmp);
                log.END();
            }
        });
    },

    /**
     * Remove a template from the table store.
     */
    del: function(params, callback) {
        var self = this;
        var log = self.log.child('del');
        log.BEGIN(params);

        var partitionKey = self.makePartitionKey(params.eventId);
        log.debug('partitionKey:', partitionKey);

        var rowKey = self.makeRowKey(params.notificationId, params.route, params.templateVersion,
                                     params.templateLanguage, params.service);
        log.debug('rowKey:', rowKey);

        var entity = {
            'PartitionKey': partitionKey,
            'RowKey': rowKey,
            'NotificationId': params.notificationId.toString(),
            'Route': params.route.toString(),
            'TemplateVersion': params.templateVersion.toString(),
            'TemplateLanguage': params.templateLanguage.toString(),
            'Service': params.service.toString()
        };

        log.debug(entity);

        self.cache.del(params.eventId, entity);

        self.store.deleteEntity(self.tableName, entity, function(err, tmp) {
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
        return (new Buffer(value.toString())).toString('base64');
    },

    makeEntityKey: function(notificationId, routeName, templateVersion, templateLanguage, service) {
        return this.makeKey(routeName, templateVersion, templateLanguage, service) + notificationId.toString();
    },

    /**
     * Make a table store row key
     */
    makeRowKey: function(notificationId, routeName, templateVersion, templateLanguage, service) {
        return (new Buffer(this.makeEntityKey(notificationId, routeName, templateVersion, templateLanguage, service)))
                              .toString('base64');
    }
};
