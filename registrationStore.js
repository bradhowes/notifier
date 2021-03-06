'use strict';

/**
 * @fileOverview Defines the RegistrationStore prototype and its methods.
 */
module.exports = RegistrationStore;

var azure = require('azure');
var async = require('async');
var RegistrationFilter = require('./registrationFilter');

/**
 * RegistrationStore constructor.
 *
 * @class RegistrationStore
 */
function RegistrationStore(tableName, callback) {
    var self = this;
    var log = this.log = require('./config').log('RegistrationStore');
    log.BEGIN(tableName);
    if (tableName === undefined) {
        tableName = config.registrations_table_name;
    }

    this.tableName = tableName;
    this.store = azure.createTableService();

    var checkCreateTableIfNotExists = function (err, b, c) {
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
}

/**
 * Store prototype.
 *
 * Defines the methods available to a Store instance.
 */
RegistrationStore.prototype = {

    makePartitionKey: function (value) {
        return new Buffer(value).toString('base64');
    },

    makeRowKey: function (value) {
        return new Buffer(value).toString('base64');
    },

    /**
     * Obtain all registration entities for a given user.
     *
     * @param {String} partitionKey the partition where the registrations reside
     * @param {function(error, found)} callback method to invoke when the query is done
     *
     * @private
     */
    _getEntities: function (partitionKey, callback) {
        var log = this.log.child('_getEntities');
        log.BEGIN(partitionKey);
        var query = azure.TableQuery.select()
                                    .from(this.tableName)
                                    .where('PartitionKey eq ?', partitionKey);
        this.store.queryEntities(query, callback);
        log.END();
    },

    /**
     * Delete a specific registration for a given user.
     *
     * @param {String} partitionKey the partition where the registration resides
     *
     * @param {String} rowKey the row key of the registration to delete
     *
     * @param {function(err)} callback the function to call when done
     *
     * @private
     */
    _delEntity: function (partitionKey, rowKey, callback) {
        var log = this.log.child('_delEntity');
        log.BEGIN('partitionKey:', partitionKey, 'rowKey:', rowKey);
        var entity = {
            PartitionKey: partitionKey,
            RowKey: rowKey
        };
        this.store.deleteEntity(this.tableName, entity, function (err) {
            callback(err);
            log.END(err);
        });
    },

    /**
     * Create a JSON object from a registration table store entity.
     *
     * @param {Object} registrationEntity the entity to convert
     * @param {function(reg)} filter a filter o invoke on each registration object to see if it is wanted in the results
     * @return {Object} registration object or null.
     */
    _registrationFromEntity: function (registrationEntity, filter) {
        var log = this.log.child('_registrationFromEntity');
        log.BEGIN(registrationEntity);

        var registration = {
            deviceId: new Buffer(registrationEntity.RowKey, 'base64').toString('ascii'),
            templateVersion: registrationEntity.TemplateVersion.substr(1),
            templateLanguage: registrationEntity.TemplateLanguage,
            service: registrationEntity.Service,
            expiration: registrationEntity.Expiration,
            routes: null
        };

        var now = new Date();
        now = now.toISOString();

        var routes = [];
        try {
            routes = JSON.parse(registrationEntity.Routes);
        }
        catch (err) {
            log.error('failed to parse registrationEntity.Routes:', registrationEntity.Routes);
        }

        log.debug('routes:', routes);

        var valid = [];
        for (var each in routes) {
            var route = routes[each];
            log.debug('route:', route);
            if (route.Expiration > now) {
                var blah = {
                    "name": route.Name,
                    "token": route.Token,
                    "expiration": route.Expiration
                };

                log.debug('blah:', blah);
                if (filter.passed(registration, blah)) {
                    log.debug('using route', blah);
                    valid.push(blah);
                }
            }
            else {
                log.info('route is no longer active:', blah);
            }
        }

        if (valid.length === 0) {
            registration = null;
        }
        else {
            log.debug('valid routes:', valid);
            registration.routes = valid;
        }

        log.END(registration);
        return registration;
    },

    /**
     * Obtain the registrations for a given user, subject to them passing the given filter.
     *
     * @param {String} userId the user to query
     * @param {Object} filter attributes to use to pass only certain registrations
     * @param {function(err, registrations)} callback methoed to invoke when the fetching is done
     */
    get: function (userId, filter, callback) {
        var self = this;
        var log = self.log.child('get');
        log.BEGIN(userId, filter);

        var partitionKey = this.makePartitionKey(userId);
        this._getEntities(partitionKey, function (err, regs) {
            if (err !== null) {
                log.error('_getEntities error:', err);
                callback(err, null);
                return;
            }

            log.error('found:', regs);

            var registrations = [];

            if (regs.length === 0) {
                log.info('no registrations found');
                callback(null, registrations);
                return;
            }

            filter = new RegistrationFilter(filter);

            var now = new Date();
            now = now.toISOString();

            function delEntityCallback (err) {
                if (err) log.error('_delEntity error:', err);
            }

            for (var index in regs) {
                var registrationEntity = regs[index];
                if (registrationEntity.Expiration <= now) {
                    log.info('registration has expired:', registrationEntity.RowKey);
                    self._delEntity(partitionKey, registrationEntity.RowKey, delEntityCallback);
                }
                else {
                    var r = self._registrationFromEntity(registrationEntity, filter);
                    if (r) registrations.push(r);
                }
            }
            callback(null, registrations);
            log.END();
        });
    },

    /**
     * Update a specific registration for a given user.
     *
     * @param {Object} registration the registration settings to use or update
     * @param {Function} callback nethod to invoke when the query is done
     */
    set: function (registration, callback) {
        var self = this;
        var log = self.log.child('set');
        log.BEGIN(registration);

        var partitionKey = this.makePartitionKey(registration.userId);
        log.debug('partitionKey:', partitionKey);

        var rowKey = this.makeRowKey(registration.deviceId);
        log.debug('rowKey:', rowKey);

        self.store.queryEntity(self.tableName, partitionKey, rowKey, function (err, found) {
            log.info('queryEntity results:', err, found);

            var registrationEntity = {
                'PartitionKey': partitionKey,
                'RowKey': rowKey,
                'TemplateLanguage': registration.templateLanguage,
                'TemplateVersion': 'v' + registration.templateVersion,
                'Service': registration.service,
                'Expiration': null,
                'Routes': null
            };

            var now = Date.now();
            var oldest = now;
            var routes = registration.routes;

            for (var index in registration.routes) {
                var route = routes[index];
                var expiration = now + route.secondsToLive * 1000;
                if (oldest < expiration) {
                    oldest = expiration;
                }
                route = {
                    'Name': route.name,
                    'Token': route.token,
                    'Expiration': (new Date(expiration)).toISOString()
                };

                log.debug('new route:', route);
                routes[index] = route;
            }

            registrationEntity.Expiration = (new Date(oldest)).toISOString();
            registrationEntity.Routes = JSON.stringify(routes);
            if (! found) {
                self.store.insertEntity(self.tableName, registrationEntity, callback);
            }
            else {
                self.store.updateEntity(self.tableName, registrationEntity, callback);
            }

            log.END();
	});
    },

    /**
     * Delete a specific registration for a given user.
     *
     * @param userId
     *   The user to look for.
     *
     * @param deviceId
     *   The device entry to delete.
     *
     * @param callback
     *   Method to invoke when the deletion is done.
     *   - err: if not null, definition of the error that took place
     *
     * @private
     */
    del: function (userId, deviceId, callback) {
        var log = this.log.child('del');
        log.BEGIN(userId, deviceId);
        this._delEntity(this.makePartitionKey(userId), this.makeRowKey(deviceId), function (err) {
            callback(err);
            log.END(err);
        });
    },

    /**
     * Delete a specific registration for a given user.
     *
     * @param userId
     *   The user to look for.
     *
     * @param deviceId
     *   The registration to delete.
     *
     * @param callback
     *   Method to invoke when the deletion is done.
     *   - err: if not null, definition of the error that took place
     *
     * @private
     */
    delRoute: function (userId, deviceId, routeNameOrToken) {
        var log = this.log.child('delRoute');
        log.BEGIN(userId, deviceId, routeToken);

        var partitionKey = this.makePartitionKey(userId);
        log.debug('partitionKey:', partitionKey);

        var rowKey = this.makeRowKey(deviceId);
        log.debug('rowKey:', rowKey);

        self.store.queryEntity(self.tableName, partitionKey, rowKey, function (err, entity) {
            log.info('queryEntity results:', err, entity);

            var routes = JSON.parse(entity.Routes);
            var oldest = Date.now();
            var newRoutes = [];
            for (var index in routes) {
                var route = routes[index];
                if (route.Name !== routeNameOrToken && route.Token !== routeNameOrToken) {
                    if (oldest < route.Expiration) {
                        oldest = route.Expiration;
                    }
                    newRoutes.push(route);
                }
            }

            if (newRoutes.length === 0) {
                self.del(userId, deviceId, function (err) {
                    log.END(err);
                });
            }
            else {
                var registrationEntity = {
                    'PartitionKey': partitionKey,
                    'RowKey': rowKey,
                    'TemplateLanguage': entity.TemplateLanguage,
                    'TemplateVersion': entity.TemplateVersion,
                    'Service': entity.Service,
                    'Expiration': (new Date(oldest)).toISOString(),
                    'Routes': JSON.stringify(newRoutes)
                };
                self.store.updateEntity(self.tableName, registrationEntity, function (err) {
                    log.END(err);
                });
            }
	});
    },

    /**
     * Delete all registrations for a given user.
     *
     * @param userId
     *   The user to delete.
     *
     * @param callback
     *   Method to invoke when the deletion is done.
     *   - err: if not null, definition of the error that took place
     */
    delAll: function (userId, callback) {
        var self = this;
        var log = self.log.child('deleteAll');
        var errors = null;
        var partitionKey = this.makePartitionKey(userId);

        function mapper(entity, entityCallback) {
            var rowKey = entity.RowKey;
            log.debug('deleting registration', rowKey);
            self._delEntity(
                partitionKey, rowKey, function (err) {
                    if (err) {
                        if (errors === null) {
                            errors = {};
                        }
                        errors[rowKey] = err;
                    }
                    entityCallback(null, null);
                });
        }

        function reducer(err, results) {
            callback(errors);
            log.END();
        }

        log.BEGIN(userId);

        self._getEntities(
            partitionKey, function (err, registrationEntities) {
                if (err || registrationEntities === null || registrationEntities.length === 0) {
                    callback(err);
                }
                else {
                    async.map(registrationEntities, mapper, reducer);
                }
            });
    }
};
