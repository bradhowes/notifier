/**
 * @fileOverview Defines the TemplateCache prototype and its methods.
 */
module.exports = TemplateCache;

var config = require('./config');
var TemplateParser = require('./templateParser');
var NotificationRequest = require('./notificationRequest');

/**
 * TemplateCache constructor.
 *
 * @class
 *
 * A TemplateCache records in-memory templates fetched from an Azure table store. It consists of a top-level hash, with
 * keys made up of Azure table store partition keys that are derived from notification event ID values. Each entry in
 * this hash is itself a hash, where the keys are made up of various template attributes, and the value is an array
 * (there can be more than one template associated with a notification event ID).
 */
function TemplateCache() {
    var log = this.log = config.log('TemplateCache');
    log.BEGIN();

    this.cache = {};

    /**
     * Holds the functions to invoke to generate search keys. For a registration with a templateLanguage value of
     * "de-AU" (Austrian German), there are three queries that can be made:
     *
     * - de-AU - original language value
     * - de - base language value
     * - en - default language value
     *
     * These functions are invoked in sequence, and if they return a non-null value, then the key they generated will
     * be used to search for a template.
     *
     * @type function array
     */
    this.findKeyGenerators = [
        this.makeKey,
        this.makeBaseLanguageKey,
        this.makeDefaultLanguageKey
    ];
    log.END();
}

/**
 * TemplateCache.Entry constructor.
 *
 * @class
 *
 * Represents entries in the cache. Each one has a parsed template function to be used to generate notification
 * payloads.
 *
 * @param {Object} entity the Azure table store entity to remember. Records the entity.NotificationId and the
 * entity.Content values. The latter is then parsed into a function that can be used to generate notification payloads.
 */
TemplateCache.Entry = function(entity) {
    var log = config.log('TemplateCache.Entry');
    log.BEGIN(entity);
    this.notificationId = entity.NotificationId;
    log.debug('notificationId:', this.notificationId);

    try {
        log.debug('attempting to convert entity.Content into JSON:', entity.Content);
        this.template = JSON.parse(entity.Content);
        log.debug('done:', this.template);
        try {
            log.debug('attempting to parse template.content:', this.template.content);
            this.template.content = TemplateParser.parse(this.template.content);
            log.debug('done:', this.template.content);
        }
        catch(err) {
            log.error('failed to parse template:', this.template.content);
            log.error(err);
            this.template.content = null;
        }
    }
    catch (err) {
        log.error('failed to parse entity.Content as JSON:', entity.Content);
        log.error(err);
        this.content = null;
    }

    log.END();
};

TemplateCache.prototype = {

    /**
     * Make a template key.
     *
     * @param {String} routeName the name of the route associated with the template.
     * @param {String} templateVersion the version of the template
     * @param {String} templateLanguage the language of the template
     * @param {String} service the name of the OS-specific service used for notification delivery
     * @return {String} key made up of the given values.
     *
     * @private
     */
    makeKey: function(routeName, templateVersion, templateLanguage, service) {
        return routeName + '_' + templateVersion + '_' + templateLanguage + '_' + service + '_';
    },

    /**
     * Make a base-language template key, if one exists. Strips off any '-*' suffix from the templateLanguage value and
     * returns the value from {makeKey} with that value.
     *
     * @param {String} routeName the name of the route associated with the template.
     * @param {String} templateVersion the version of the template
     * @param {String} templateLanguage the language of the template
     * @param {String} service the name of the OS-specific service used for notification delivery
     * @return {String} key made up of the given values, or null if there was no extension present
     *
     * @private
     */
    makeBaseLanguageKey: function(routeName, templateVersion, templateLanguage, service) {
        var pos = templateLanguage.indexOf('-');
        if (pos > 0) {
            return this.makeKey(routeName, templateVersion, templateLanguage.substr(0, pos), service);
        }
        return null;
    },

    /**
     * Make a default language template key if it would differ from the current templateLanguage base.
     *
     * @param {String} routeName the name of the route associated with the template.
     * @param {String} templateVersion the version of the template
     * @param {String} templateLanguage the language of the template
     * @param {String} service the name of the OS-specific service used for notification delivery
     * @return {String} key made up of the given values, or null if not relevant
     *
     * @private
     */
    makeDefaultLanguageKey: function(routeName, templateVersion, templateLanguage, service) {
        if (templateLanguage.substr(0, 2) !== 'en'){
            return this.makeKey(routeName, templateVersion, 'en', service);
        }
        return null;
    },

    /**
     * Fetch templates generators from the cache that match the given partitionKey and user registration settings.
     * Generates a key template key for each registration route in each registration, and looks for it within the
     * cache. If found, it creates a new NotificationRequest object based on the cache entry.
     *
     * @param {String} partitionKey the key associated with the notification event to use for fetching
     * @param {Array} registrations  the set of user registrations to use for matching
     * @return array of {@link NotificationRequest} instances appropriate for the registrations
     */
    get: function(partitionKey, registrations) {
        var log = this.log.child('get');
        log.BEGIN(partitionKey, registrations);

        var templates = this.cache[partitionKey];
        if (typeof templates === 'undefined') {
            log.END('no cached entry');
            return templates;
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
                for (var keyIndex in this.findKeyGenerators) {
                    key = this.findKeyGenerators[keyIndex].call(this, routeName, templateVersion, templateLanguage,
                                                                service);
                    if (key === null) {
                        continue;
                    }

                    log.debug('looking for key:', key);
                    var found = templates[key];
                    if (typeof found !== 'undefined' && found.length > 0) {
                        log.debug('found: ', found);
                        found.forEach(function (entry) {
                            matches.push(new NotificationRequest(registration.registrationId, service, route.token,
                                                                 entry.template));
                        });
                        break;
                    }
                }
            }
        }

        log.END(matches);
        return matches;
    },

    /**
     * Replace any existing cache entries with the ones given.
     *
     * @param {String} partitionKey the key associated with the notification event to use for fetching
     * @param {Array} entities  the set of template entities to store in the cache
     */
    set: function(partitionKey, entities) {
        var self = this;
        var log = this.log.child('set');
        log.BEGIN(partitionKey, entities);

        // Clear the cache for this event ID
        this.cache[partitionKey] = {};

        // Add all of the entities to the cache.
        entities.forEach(function (item) {self.add(item);});

        log.END(this.cache);
    },

    /**
     * Add or replace one template entity in the cache.
     *
     * @param {Object} entity the Azure table store entity to remember
     */
    add: function(entity)  {
        var log = this.log.child('add');
        log.BEGIN(entity);

        var key = entity.PartitionKey;
        var templateMap = this.cache[key];
        if (typeof templateMap === 'undefined') {
            log.END('no cached entry');
            return;
        }

        var entry = new TemplateCache.Entry(entity);
        log.debug('entry:', entry);

        key = this.makeKey(entity.Route, entity.TemplateVersion, entity.TemplateLanguage, entity.Service);
        log.debug('key:', key);

        var found = templateMap[key];
        if (typeof found  === 'undefined') {
            log.debug('new entry');
            templateMap[key] = found = [entry];
        }
        else {
            for (var foundIndex in found) {
                if (found[foundIndex].notificationId === entity.NotificationId) {
                    log.debug('replacing entry');
                    found[foundIndex] = entry;
                    entry = null;
                    break;
                }
            }

            if (entry) {
                log.debug('new entry');
                found.push(entry);
            }
        }

        log.END(found);
    },

    /**
     * Remove a template entity from the cache.
     *
     * @param {Object} entity the Azure table store entity to forget
     */
    del: function(entity) {
        var log = this.log.child('del');
        log.BEGIN(entity);

        // Get the template hash in the top-level hash.
        var key = entity.PartitionKey;
        var entities = this.cache[key];
        if (typeof entities === 'undefined') {
            log.END('no cached entry');
            return;
        }

        key = this.makeKey(entity.Route, entity.TemplateVersion, entity.TemplateLanguage, entity.Service);
        log.debug('key:', key);

        // Get the bucket from the template hash
        var found = entities[key];
        if (typeof found  === 'undefined') {
            log.END('not found');
            return;
        }

        // Now look for the matching notificationId within the bucket and remove if found
        for (var foundIndex in found) {
            if (found[foundIndex].notificationId === entity.NotificationId) {
                log.debug('deleting index:', foundIndex);
                found.splice(foundIndex, 1);
                break;
            }
        }

        log.END();
    }
};
