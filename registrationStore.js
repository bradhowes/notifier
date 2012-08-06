'use strict';

/**
 * @fileOverview Defines the RegistrationStore prototype and its methods.
 */
module.exports = RegistrationStore;

var azure = require('azure');
var async = require('async');
var Filter = require('./filter');

/**
 * RegistrationStore constructor.
 *
 * @class RegistrationStore
 */
function RegistrationStore(tableName, callback) {
    var log = this.log = require('./config').log('RegistrationStore');
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
}

/**
 * Store prototype.
 *
 * Defines the methods available to a Store instance.
 */
RegistrationStore.prototype = {

    makePartitionKey: function(value) {
        return new Buffer(value).toString('base64');
    },

    makeRowKey: function(value) {
        return new Buffer(value).toString('base64');
    },

    /**
     * Obtain all registration entities for a given user.
     *
     * @param {string} userId
     *   The user to look for.
     *
     * @param {function} callback
     *   Method to invoke when the query is done
     *   - err: if not null, definition of the error that took place
     *   - found: array of found registration entities for the user
     *
     * @private
     */
    _getAllRegistrationEntities: function (partitionKey, callback) {
        var log = this.log.child('getAllRegistrationEntities');
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
     * @param userId
     *   The user to look for.
     *
     * @param registrationId
     *   The registration to delete.
     *
     * @param callback
     *   Method to invoke when the deletion is done.
     *   - err: if not null, definition of the error that took place
     *
     * @private
     */
    _deleteRegistrationEntity: function (partitionKey, rowKey, callback) {
        var log = this.log.child('_deleteRegistrationEntity');
        log.BEGIN('partitionKey:', partitionKey, 'rowKey:', rowKey);
        var entity = {
            PartitionKey: partitionKey,
            RowKey: rowKey
        };
        this.store.deleteEntity(this.tableName, entity,
                                function (err) {
                                    callback(err);
                                    log.END(err);
                                });
    },

    _getRegistration: function (registrationEntity, filter) {
        var log = this.log.child('_getRegistration');
        log.BEGIN(filter, typeof filter);

        var registration = {
            registrationId: new Buffer(registrationEntity.RowKey, 'base64').toString('ascii'),
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
            if (route.Expiration > now) {
                route = {
                    "name": route.Name,
                    "token": route.Token,
                    "expiration": route.Expiration
                };

                if (filter.passed(registration, route)) {
                    log.debug('using route', route.Name, 'token:', route.Token);
                    valid.push(route);
                }
            }
            else {
                log.info('route', route.Name, 'is no longer active');
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

    getRegistrations: function(userId, filter, callback) {
        var self = this;
        var log = self.log.child('getRegistrations');
        log.BEGIN(userId, filter);

        var partitionKey = this.makePartitionKey(userId);

        this._getAllRegistrationEntities(
            partitionKey, function(err, regs) {
                if (err !== null) {
                    log.error('_getAllRegistrationEntities error:', err);
                    callback(err, null);
                    return;
                }

                var registrations = [];

                if (regs.length === 0) {
                    log.info('no registrations found');
                    callback(null, registrations);
                    return;
                }

                filter = new Filter(filter);

                var now = new Date();
                now = now.toISOString();

                function deleteRegistrationCallback (err) {
                    if (err) log.error('_deleteRegistrationEntity error:', err);
                }

                for (var index in regs) {
                    var registrationEntity = regs[index];
                    if (registrationEntity.Expiration <= now) {
                        log.info('registration has expired:', registrationEntity.RowKey);
                        self._deleteRegistrationEntity(partitionKey, registrationEntity.RowKey,
                                                       deleteRegistrationCallback);
                    }
                    else {
                        var r = self._getRegistration(registrationEntity, filter);
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
     * @param userId
     *   The user to update.
     *
     * @param registrationId
     *   The registration to add or update.
     *
     * @param templateVersion
     *   The template version that this registration expects.
     *
     * @param templateLanguage
     *   The text language that this registration expects.
     *
     * @param context
     *   The service that will handle final notification delivery.
     *
     * @param routes
     *   Array of one or more notification routes for this registration.
     *
     * @param callback
     *   Method to invoke when the query is done
     *   - err: if not null, definition of the error that took place
     *   - found: if no error, the existing registration entity
     */
    updateRegistration: function(registration, callback) {
        var self = this;
        var log = self.log.child('updateRegistration');
        log.BEGIN(registration);

        var partitionKey = this.makePartitionKey(registration.userId);
        log.debug('partitionKey:', partitionKey);

        var rowKey = this.makeRowKey(registration.registrationId);
        log.debug('rowKey:', rowKey);

        self.store.queryEntity(
            self.tableName, partitionKey, rowKey, function (err, found) {
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
     * @param registrationId
     *   The registration to delete.
     *
     * @param callback
     *   Method to invoke when the deletion is done.
     *   - err: if not null, definition of the error that took place
     *
     * @private
     */
    deleteRegistration: function (userId, registrationId, callback) {
        var log = this.log.child('deleteRegistration');
        log.BEGIN(userId, registrationId);
        this._deleteRegistrationEntity(this.makePartitionKey(userId),
                                       this.makeRowKey(registrationId),
                                       function (err) {
                                           callback(err);
                                           log.END(err);
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
    deleteAllRegistrations: function (userId, callback) {
        var self = this;
        var log = self.log.child('deleteAllRegistrations');
        log.BEGIN(userId);

        var partitionKey = this.makePartitionKey(userId);

        self._getAllRegistrationEntities(
            partitionKey, function (err, registrationEntities) {
                var rowKey = null;
                var errors = null;
                var awaiting = registrationEntities.length;

                if (err || registrationEntities === null || registrationEntities.length === 0) {
                    callback(err);
                }
                else {
                    async.map(registrationEntities,
                              // Function to invoke for each entity
                              function (entity, entityCallback) {
                                  rowKey = entity.RowKey;
                                  log.debug('deleting registration', rowKey);
                                  self._deleteRegistrationEntity(
                                      partitionKey, rowKey, function (err) {
                                          if (err) {
                                              if (errors === null) {
                                                  errors = {};
                                              }
                                              errors[rowKey] = err;
                                          }
                                          entityCallback(null, null);
                                      });
                              },
                              // Function to call once all per-entity callbacks have been invoked
                             function (err, results) {
                                 callback(errors);
                                 log.END();
                             });
                }
            });
    }
};
