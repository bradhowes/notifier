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

    self.tableName = tableName;
    self.store = azure.createTableService();
    self.cache = new TemplateCache();
    self.pendingGet = {};

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

    self.store.createTableIfNotExists(tableName, checkCreateTableIfNotExists);
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

        var partitionKey = self.makePartitionKey(eventId);
        var found = self.cache.get(partitionKey, registrations);
        if (typeof found === 'undefined') {
            var pending = self.pendingGet[partitionKey];
            if (typeof pending !== 'undefined') {
                pending.push([registrations, callback]);
                return;
            }

            pending = [];
            pending.push([registrations, callback]);
            self.pendingGet[partitionKey] = pending;

            self.getEntities(eventId, function (err, found) {
                if (err) {
                    log.error('failed to fetch templates:', err);
                }
                else {
                    self.cache.set(partitionKey, found);
                }

                pending = self.pendingGet[partitionKey];
                delete self.pendingGet[partitionKey];

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
    getEntities: function(eventId, callback) {
        var self = this;
        var log = self.log.child('getEntities');

        log.BEGIN(eventId);
        var partitionKey = self.makePartitionKey(eventId);
        var query = azure.TableQuery.select()
                                    .from(self.tableName)
                                    .where('PartitionKey eq ?', partitionKey);
        self.store.queryEntities(query, function(err, entities) {
            var entity, entityIndex;
            if (err) {
                log.error('queryEntities error:', err);
                callback(err, null);
                return;
            }
            callback(null, entities);
        });
    },

    getTemplates: function(params, callback) {
        var self = this;
        var log = self.log.child('getTemplates');

        log.BEGIN(params);
        var partitionKey = self.makePartitionKey(params.eventId);
        log.debug('partitionKey:', partitionKey);

        var query = azure.TableQuery.select()
                                    .from(self.tableName)
                                    .where('PartitionKey eq ?', partitionKey);
        self.store.queryEntities(query, function(err, entities) {
            var found, entity, entityIndex;
            if (err) {
                log.error('queryEntities error:', err);
                callback(err, null);
                return;
            }

            callback(null, self.entitiesToJson(params.eventId, entities));
        });
    },

    entitiesToJson: function(eventId, entities) {
        var converted = [];
        var entity, entityIndex;
        for (entityIndex in entities) {
            entity = entities[entityIndex];
            converted.push(
                {
                    eventId: parseInt(eventId),
                    notificationId: parseInt(entity.NotificationId),
                    route: entity.Route,
                    templateVersion: entity.TemplateVersion,
                    templateLanguage: entity.TemplateLanguage,
                    service: entity.Service,
                    template: JSON.parse(entity.Content)
                });
        }
        return converted;
    },

    /**
     * Get a template from the table store.
     */
    get: function(params, callback) {
        var self = this;
        var log = self.log.child('get');
        log.BEGIN(params);

        var partitionKey = self.makePartitionKey(params.eventId);
        log.debug('partitionKey:', partitionKey);

        var rowKey = self.makeRowKey(params.notificationId, params.route, params.templateVersion,
                                     params.templateLanguage, params.service);
        log.debug('rowKey:', rowKey);

        var query = azure.TableQuery.select()
                                    .from(self.tableName)
                                    .where('PartitionKey eq ? and RowKey eq ?', partitionKey, rowKey);
        self.store.queryEntities(query, function(err, entities) {
            if (err) {
                log.error('queryEntities error:', err);
                callback(err, null);
                return;
            }

            callback(null, self.entitiesToJson(params.eventId, entities));
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
                        self.cache.add(entity);
                    }
                    callback(err, tmp);
                    log.END();
                });
            }
            else {
                self.cache.add(entity);
                callback(err, tmp);
                log.END();
            }
        });
    },

    /**
     * Remove a template from the table store.
     *
     * @param {Object} params specification of the template to remove
     * @param {function(err,entity)} callback function to invoke upon completion of the deletion
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

        self.cache.del(entity);

        self.store.deleteEntity(self.tableName, entity, function(err, tmp) {
            if (err) {
                log.error('TableStore.deleteEntity error:', err);
            }
            callback(err, tmp);
        });
    },

    /**
     * Make a table store partition key. For templates, the partition key is the notification event ID. However, we
     * encode in base64 just to be safe against values harmful to Azure table store.
     *
     * @param {String|Number} value the value to use for the key
     * @return {String} value safe to use in Azure table store for the partition key.
     */
    makePartitionKey: function(value) {
        return (new Buffer(value.toString())).toString('base64');
    },

    /**
     * Make a table store row key. This will point to a specific template payload definition. As such, it must be
     * uniquely specified in 5 dimensions: notification ID, route name, template version, template language, and
     * notification delivery service.
     *
     * @param {String|Integer} notificationId the notification ID associated with the template
     * @param {String} routeName the route name associated with the template
     * @param {String} templateVersion the version of the template being keyed
     * @param {String} templateLanguage the language of the template being keyed
     * @param {String} service the notification delivery service to use
     * @return {String} concatenated value of the above encoded in base64 for Azure table store safety
     */
    makeRowKey: function(notificationId, routeName, templateVersion, templateLanguage, service) {
        return (new Buffer(routeName + '_' + templateVersion + '_' + templateLanguage + '_' + service + '_' +
                           notificationId)).toString('base64');
    }
};
