"use strict";

module.exports = MonitorManager;

var azure = require('azure');
var Q = require('q');
var config = require('./config');

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

    self.userMonitoringExpirations = {};
    self.userMonitoringExpirations[config.monitor_command_channel_name] = false;

    self.postPromiseChain = Q();
    self.registrationMonitor = null;

    self.createTopic(isServer, callback);
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
        if (monitor.userId == config.monitor_command_channel_name) {
            log.END();
            if (callback) callback(null);
            return;
        }

        self.post(config.monitor_command_channel_name, '+' + monitor.userId, function (err) {
            if (err) log.error('failed to post monitor command for', monitor.userId, err);
            log.END();
            if (callback) callback(err);
        });
    },

    unregisterMonitor: function(monitor, callback) {
        var self = this;
        var log = self.log.child('unregisterMonitor');
        log.BEGIN(monitor.userId, monitor.name);
        if (monitor.userId == config.monitor_command_channel_name) {
            log.END();
            if (callback) callback(null);
            return;
        }

        self.post(monitor.userId, '*** monitoring stopped ***', function (err) {
            self.post(config.monitor_command_channel_name, '-' + monitor.userId, function (err) {
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
            log.debug('calling receiveSubscriptionMessage');
            self.serviceBusService.receiveSubscriptionMessage(self.topicName, monitor.name,
                function (err, found) {
                    if (err && err != 'No messages to receive') {
                        log.error(err);
                        log.error('stopping read loop');
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
            if (err) {

                // readLoop stops when there is an error - restart ourselves.
                //
                self.commandLoop();
            }
            else if (found) {
                var command = found.body[0];
                var userId = found.body.slice(1);

                // Monitoring activationg request - allow for a fixed interval
                //
                if (command == '+') {
                    var expiration = new Date();
                    expiration.setMinutes(expiration.getMinutes() + config.monitor_duration_minutes);
                    log.debug('starting to monitor:', userId, 'expires:', expiration);
                    self.userMonitoringExpirations[userId] = expiration;
                    self.post(userId, '*** monitoring started ***');
                }

                // Monitoring termination request. Note this wil terminate multiple monitors for the same user ID.
                //
                else if (command == '-') {
                    log.debug('stop monitoring:', userId);
                    delete self.userMonitoringExpirations[userId];
                }

                else {
                    log.error('invalid monitor channel command:', command);
                }
            }

            // Keep the readLoop running.
            //
            return true;
        });
        log.END();
    },

    cleanup: function() {
        var self = this;
        var log = self.log.child('cleanup');

        // Fetch the list of active subscriptions to our topic. Cull those that are older than twice the monitoring
        // interval.
        //
        self.serviceBusService.listSubscriptions(self.topicName, function (err, subs, response) {
            if (err) {
                log.error('failed listSubscriptions:', err);
            }
            else {
                log.debug('found', subs.length, 'subsciptions');
                var cutoff = new Date();
                cutoff.setHours(cutoff.getMinutes() - 2 * config.monitor_duration_minutes);
                for (var i = 0; i < subs.length; ++i) {
                    var name = subs[i].SubscriptionName;
                    var when = new Date(subs[i].AccessedAt);
                    if (name == config.monitor_command_channel_name) {
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

            setTimeout(self.cleanup.bind(self), config.monitor_cleanup_interval_minutes * 60 * 1000);
        });
    },

    createTopic: function(isServer, callback) {
        var self = this;
        var log = self.log.child('createTopic');
        log.BEGIN('isServer:', isServer);
        var proc = function() {
            log.debug('calling createTopicIfNotExists');
            self.serviceBusService.createTopicIfNotExists(self.topicName, self.topicConfig, function (err) {
                if (err) {
                    log.error('failed createTopicIfNotExists:', err);
                    if (err.statusCode === 409) { // Busy - try again after 1 second.
                        log.debug('trying again in 1 second');
                        Q.delay(1000).then(proc);
                        return;
                    }
                    log.END(err);
                    if (callback) callback(err);
                }
                else if (isServer) {

                    // Create the monitor for the command channel. This will listen for monitor start/stop commands.
                    //
                    log.debug('creating command channel monitor');
                    self.makeMonitor(config.monitor_command_channel_name, function (err, monitor) {
                        log.END(err);
                        self.registrationMonitor = monitor;
                        self.cleanup();
                        self.commandLoop();
                        if (callback) callback(err);
                    });
                }
                else {
                    if (callback) callback(null);
                }
            });
        };
        proc();
    }
};
