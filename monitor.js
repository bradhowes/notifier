"use strict";

module.exports = MonitorManager;

var azure = require('azure');
var Q = require('q');
var Model = require('model.js');
var HTTPStatus = require('http-status');
var config = require('./config');
var Deque = require('./deque');

function MonitorManager(topicName, isServer, callback) {
    var self = this;

    var log = this.log = config.log('MonitorManager');
    log.BEGIN();

    if (! topicName) {
        topicName = config.monitor_topic_name;
    }

    self.topicName = topicName;
    self.serviceBusService = azure.createServiceBusService();
    self.topicConfig = { MaxSizeInMegabytes: '1024', DefaultMessageTimeToLive: 'PT1M' };

    self.userMonitoringExpirations = {'*':false};
    self.postPromiseChain = Q();
    self.registrationMonitor = null;

    var checkCreateTopicIfNotExists = function(err) {
        if (err) {
            log.error(err);
            if (err.statusCode === 409) {
                Q.delay(1000)
                 .then(function () {
                     self.serviceBusService.createTopicIfNotExists(
                         self.topicName,
                         self.topicConfig,
                         checkCreateTopicIfNotExists);
                     });
                return;
            }

            if (callback) callback(err);
        }
        else {
            if (isServer) {
                self.makeMonitor('*', function (err, monitor) {
                    log.END(err);
                    self.registrationMonitor = monitor;
                    if (callback) callback(err);
                    self.cleanup();
                    self.commandLoop();
                });
            }
            else {
                if (callback) callback(null);
            }
        }
    };

    self.serviceBusService.createTopicIfNotExists(self.topicName, self.topicConfig, checkCreateTopicIfNotExists);

    log.END();
}

function Monitor(manager, name, userId) {
    var log = this.log = config.log('Monitor ' + userId);
    this.mgr = manager;
    this.userId = userId;
    this.name = name;
    this.socket = null;
    this.expiration = null;
};

Monitor.prototype = {

    register: function() {
        var self = this;
        var log = self.log.child('register');
        log.BEGIN();
        if (self.mgr) {
            self.mgr.registerMonitor(self);
        }
        log.END();
    },

    unregister: function() {
        var self = this;
        var log = self.log.child('unregister');
        log.BEGIN();

        if (self.mgr) {
            self.mgr.unregisterMonitor(self);
            self.mgr = null;
        }

        log.END();
    }
};

MonitorManager.prototype = {

    addSocket: function(userId, socket) {
        var self = this;
        var log = self.log.child('addSocket');
        self.makeMonitor(userId, function(err, monitor) {
            if (err) {
                log.error('failed to create a monitor for the socket');
            }
            else {
                log.debug('using monitor', monitor.name);

                socket.on('disconnect', function () {
                    log.error('remote socket disconnected');
                    monitor.socket = null;
                    monitor.unregister();
                });

                monitor.socket = socket;
                socket.monitor = monitor;

                self.readLoop(monitor, function (err, line) {
                    if (! monitor.socket || ! monitor.mgr) return false;
                    log.debug('sending to web client');
                    monitor.socket.emit('line', line);
                    return true;
                });
            }
            log.END();
        });
    },

    removeSocket: function(userId, socket) {
        var self = this;
        var log = self.log.child('removeSocket');
        log.BEGIN('userId:', userId, 'monitor:', socket.monitor);
        self.unregisterMonitor(socket.monitor);
    },

    makeMonitor: function(userId, callback) {
        var self = this;
        var log = self.log.child('makeMonitor');
        var name = 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
            var r = Math.random()*16|0, v = c == 'x' ? r : (r&0x3|0x8);
            return v.toString(16);
        });

        log.BEGIN('name:', name);
        log.BEGIN('userId:', userId);

        // Create the new subscription
        //
        self.serviceBusService.createSubscription(self.topicName, name,
            function (err) {
                if (err) {
                    log.error('failed to create subscription:', err);
                    callback(err, null);
                    return;
                }

                log.debug('created subscription');

                // Subscription created. Remove the default MatchAll rule
                self.serviceBusService.deleteRule(self.topicName,
                                                  name,
                                                  azure.Constants.ServiceBusConstants.DEFAULT_RULE_NAME,
                    function (err) {
                        if (err) log.error(err);
                        log.debug('removed existing rule');
                        var options = { sqlExpressionFilter: "userId = '" + userId + "'"};

                        // Create our own filter to match only the given user ID
                        self.serviceBusService.createRule(self.topicName,
                                                          name,
                                                          'filter',
                                                          options,
                            function (err) {
                                if (err) {
                                    log.error('failed to create filter:', err);
                                    callback(err, null);
                                }
                                else {
                                    var monitor = new Monitor(self, name, userId);
                                    log.debug('created new rule filtering on', userId);
                                    self.registerMonitor(monitor, function (err) {
                                        callback(err, monitor);
                                    });
                                }
                            });
                    });
            });
    },

    registerMonitor: function(monitor, callback) {
        var self = this;
        var log = self.log.child('registerMonitor');
        log.BEGIN(monitor.userId, monitor.name);
        if (monitor.userId == '*') {
            log.END();
            if (callback) callback(null);
            return;
        }

        self.post('*', '+' + monitor.userId, function (err) {
            if (err) log.error('failed to post monitor command for', monitor.userId, err);
            log.END();
            if (callback) callback(err);
        });
    },

    unregisterMonitor: function(monitor, callback) {
        var self = this;
        var log = self.log.child('unregisterMonitor');
        log.BEGIN(monitor.userId, monitor.name);
        if (monitor.userId == '*') {
            log.END();
            if (callback) callback(null);
            return;
        }

        self.post(monitor.userId, '*** monitoring stopped ***', function (err) {
            self.post('*', '-' + monitor.userId, function (err) {
                if (err) log.error('failed to post forget command for', monitor.userId, err);
                log.debug('deleting subscription for', monitor.name);
                self.serviceBusService.deleteSubscription(self.topicName, monitor.name, function (err) {
                    if (err) log.error('failed to delete subscription:', err);
                    log.END();
                    if (callback) callback(err);
                });
            });
        });
    },

    post: function(userId, line, callback) {
        var self = this;
        var log = self.log.child('post');
        var expiration = self.userMonitoringExpirations[userId];
        var proc, now;

        log.BEGIN('userId:', userId, 'line:', line, 'expiration:', expiration);

        // Silently drop anything that is not actively being monitored
        //
        if (expiration === undefined) {
            if (callback) callback(null);
            return;
        }

        log.BEGIN(userId, line);

        // Check if the monitoring has expired
        //
        now = new Date();
        if (expiration && expiration < now) {
            line = '*** monitoring for has expired ***';
            delete self.userMonitoringExpirations[userId];
        }

        proc = function () {
            var deferred = Q.defer();
            var message = { 'body': line, 'customProperties': { 'userId': userId }};
            self.serviceBusService.sendTopicMessage(self.topicName, message, function (err) {
                if (err) log.error(err);
                if (callback) callback(err);
                deferred.resolve();
            });
            return deferred.promise;
        };

        self.postPromiseChain = self.postPromiseChain.then(proc, function (err) { log.error(err); });
    },

    readLoop: function(monitor, callback) {
        var self = this;
        var log = self.log.child('readLoop ' + monitor.name);
        log.BEGIN();
        var proc = function () {
            self.serviceBusService.receiveSubscriptionMessage(self.topicName, monitor.name,
                function (err, found) {
                    if (err && err != 'No messages to receive') {
                        log.error(err);
                        return;
                    }

                    if (found) {
                        if (! callback(null, found)) {
                            log.error('stopping read loop');
                            return;
                        }
                    }
                    proc();
                });
        };
        proc();
    },

    commandLoop: function() {
        var self = this;
        var log = self.log.child('commandLoop');
        log.BEGIN();
        self.readLoop(self.registrationMonitor, function(err, found) {
            log.debug(err, found);
            if (err) {
                log.error(err);
                self.commandLoop();
            }
            else if (found) {
                var command = found.body[0];
                var userId = found.body.slice(1);
                if (command == '+') {
                    var expiration = new Date();
                    expiration.setMinutes(expiration.getMinutes() + 30);
                    log.debug('starting to monitor:', userId, 'expires:', expiration);
                    self.userMonitoringExpirations[userId] = expiration;
                    self.post(userId, '*** monitoring started ***');
                }
                else if (command == '-') {
                    log.debug('stop monitoring:', userId);
                    delete self.userMonitoringExpirations[userId];
                }
                else {
                    log.error('invalid monitor channel command:', command);
                }
            }

            return true;
        });
    },

    cleanup: function() {
        var self = this;
        var log = self.log.child('cleanup');
        self.serviceBusService.listSubscriptions(self.topicName, function (err, subs, response) {
            if (err) {
                log.error('failed listSubscriptions:', err);
            }
            else {
                log.debug('found', subs.length, 'subsciptions');
                var cutoff = new Date();
                cutoff.setHours(cutoff.getHours() - 2);
                for (var i = 0; i < subs.length; ++i) {
                    var name = subs[i].SubscriptionName;
                    var when = new Date(subs[i].AccessedAt);
                    if (name == '*') {
                        log.debug('skipping own command monitor');
                        continue;
                    }
                    if (when < cutoff) {
                        log.info('deleting stale subscription', name);
                        self.serviceBusService.deleteSubscription(self.topicName, name,
                            function (err, response) {
                                if (err) {
                                    log.error('failed to delete subscription:', err);
                                }
                                else {
                                    log.info('deleted');
                                }
                            });
                    }
                    else {
                        var remaining = when - cutoff;
                        var hours = Math.floor(remaining / (60 * 60 * 1000));
                        remaining -= hours * 60 * 60 * 1000;
                        var mins = Math.floor(remaining / (60 * 1000));
                        remaining -= mins * 60 * 1000;
                        var secs = Math.floor(remaining / 1000);
                        remaining = '';
                        if (hours < 10) remaining += '0';
                        remaining += hours + ':';
                        if (mins < 10) remaining += '0';
                        remaining += mins + ':';
                        if (secs < 10) remaining += '0';
                        remaining += secs;
                        log.debug(name, 'will be removed in', remaining);
                    }
                }
            }

            setTimeout(self.cleanup.bind(self), 10 * 60 * 1000); // every 10 minutes
        });
    }
};
