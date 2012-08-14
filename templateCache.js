/**
 * @fileOverview Defines the TemplateCache prototype and its methods.
 */
module.exports = TemplateCache;

var config = require('./config');
var TemplateParser = require('./templateParser');
var NotificationRequest = require('./notificationRequest');

/**
 * Initializes a new TemplateCache object. A TemplateCache records in-memory templates fetched from an Azure table
 * store.
 *
 * @class TemplateCache
 */
function TemplateCache() {
    var log = this.log = config.log('TemplateCache');
    log.BEGIN();

    this.cache = {};

    this.findKeyGenerators = [
        this.makeKey.bind(this),
        this.makeBaseLanguageKey.bind(this),
        this.makeDefaultLanguageKey.bind(this)
    ];

    log.END();
}

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
     * Fetch the templates from the cache that match the given eventId and user registration settings.
     */
    get: function(eventId, registrations) {
        var log = this.log.child('get');
        log.BEGIN(eventId, registrations);

        var key = eventId.toString();
        var templates = this.cache[key];
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
                    key = this.findKeyGenerators[keyIndex](routeName, templateVersion, templateLanguage, service);
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
     * Add a template entity to the cache.
     */
    set: function(eventId, templates) {
        var log = this.log.child('set');
        log.BEGIN(eventId, templates);

        var key = eventId.toString();
        var templateMap = {};
        this.cache[key] = templateMap;

        for (var index in templates) {
            this.add(eventId, templates[index]);
        }

        log.END(this.cache);
    },

    add: function(eventId, entity)  {
        var log = this.log.child('add');
        log.BEGIN(eventId, entity);

        var key = eventId.toString();
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

    del: function(eventId, template) {
        var log = this.log.child('del');
        log.BEGIN(eventId, template);

        var key = eventId.toString();
        var templates = this.cache[key];
        if (typeof templates === 'undefined') {
            log.END('no cached entry');
            return;
        }

        key = this.makeKey(template.Route, template.TemplateVersion, template.TemplateLanguage, template.Service);
        log.debug('key:', key);

        var found = templates[key];
        if (typeof found  === 'undefined') {
            log.END('not found');
            return;
        }

        for (var foundIndex in found) {
            if (found[foundIndex].notificationId === template.NotificationId) {
                log.debug('deleting index:', foundIndex);
                found.splice(foundIndex, 1);
                break;
            }
        }

        log.END();
    },

    clear: function(eventId) {
        var log = this.log.child('clear');
        log.BEGIN(eventId);
        var key = eventId.toString();
        delete this.cache[key];
        log.END();
    }
};
