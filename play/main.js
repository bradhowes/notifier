$(function() {

    console.log('here 0');
    console.log('href:', $(location).attr('href'));

    var $messages = $('.messages');
    var templates;
    var registrations;
    var notifier;

    function enable(button) {
        console.log(button);
        button.removeAttr('disabled');
    }

    function disable(button) {
        console.log(button);
        button.attr('disabled', 'disabled');
    }

    function clearLog() {
        $messages.empty();
    }

    function addLog(line) {
        var el = '<li class="entry">' + line + '</li>';
        $messages.append($(el));
    }

    function Templates() {
        this.$eventId = $('#templates #eventId');
        this.$templateVersion = $('#templates #templateVersion');
        this.$templateLanguage = $('#templates #templateLanguage');
        this.$route = $('#templates #route');
        this.$service = $('#templates #service');
        this.$content = $('#templates #content');

        this.$doQuery = $('#templates #doQuery');
        disable(this.$doQuery);
        this.$doAdd = $('#templates #doAdd');
        disable(this.$doAdd);
        this.$doClear = $('#templates #doClear');

        var proc = this.typing.bind(this);
        this.$eventId.keyup(proc);
        this.$templateVersion.keyup(proc);
        this.$templateLanguage.keyup(proc);
        this.$route.keyup(proc);
        this.$content.keyup(proc);
        this.$service.change(proc);

        this.$doAdd.click(this.doAdd.bind(this));
        this.$doClear.click(this.doClear.bind(this));
    }

    Templates.prototype = {

        typing: function(event) {
            var eventId = this.$eventId.val().trim();
            var templateVersion = this.$templateVersion.val().trim();
            var templateLanguage = this.$templateLanguage.val().trim();
            var route = this.$route.val().trim();
            var service = this.$service.val();
            var content = this.$content.val().trim();

            this.$eventId.val(eventId);
            this.$templateVersion.val(templateVersion);
            this.$templateLanguage.val(templateLanguage);
            this.$route.val(route);

            if (eventId.length > 0) {
                enable(this.$doQuery);
            }
            else {
                disable(this.$doQuery);
            }

            if (eventId.length > 0 && templateVersion.length > 0 && templateLanguage.length > 0 &&
                route.length > 0 && service.length > 0 && content.length > 0) {
                enable(this.$doAdd);
            }
            else {
                disable(this.$doAdd);
            }
        },

        doClear: function() {
            this.$eventId.val('');
            this.$templateVersion.val('');
            this.$templateLanguage.val('');
            this.$route.val('');
            this.$service.val('');
            this.$content.val('');
            clearLog();
            disable(this.$doAdd);
            disable(this.$doQuery);
        },

        doQuery: function() {
            var self = this;
            var url = '/post/' + this.$skypeId.val();
            var data = {eventId: this.$eventId.val(), substitutions:{}};
            console.log('url:', url);
            if (this.$params.val().length > 0) data.substitutions = JSON.parse(this.$params.val());
            data = JSON.stringify(data);
            console.log('data:', data);
            clearLog();
            $.ajax({
                type: 'POST',
                url: url,
                contentType: 'application/json',
                data: data,
                dataType: 'json',
                success: function(data, textStatus, jqXHR) {
                    console.log('response:', data);
                    console.log('textStatus:', textStatus);
                    addLog('Sending ' + data.count + ' notifications');
                },
                error: function(data, textStatus, jqXHR) {
                    console.log('failed:', textStatus);
                    addLog('Failed - ' + textStatus);
                }
            });
        },

        doAdd: function() {
            var self = this;
            var url = '/post/' + this.$skypeId.val();
            var data = {eventId: this.$eventId.val(), substitutions:{}};
            console.log('url:', url);
            if (this.$params.val().length > 0) data.substitutions = JSON.parse(this.$params.val());
            data = JSON.stringify(data);
            console.log('data:', data);
            clearLog();
            $.ajax({
                type: 'POST',
                url: url,
                contentType: 'application/json',
                data: data,
                dataType: 'json',
                success: function(data, textStatus, jqXHR) {
                    console.log('response:', data);
                    console.log('textStatus:', textStatus);
                    addLog('Sending ' + data.count + ' notifications');
                },
                error: function(data, textStatus, jqXHR) {
                    console.log('failed:', textStatus);
                    addLog('Failed - ' + textStatus);
                }
            });
        }
    };

    function Registrations() {
        this.$skypeId = $('#registrations #skypeId');
        this.$registrationId = $('#registrations #registrationId');
        this.$templateVersion = $('#registrations #templateVersion');
        this.$templateLanguage = $('#registrations #templateLanguage');
        this.$route = $('#registrations #route');
        this.$service = $('#registrations #service');
        this.$token = $('#registrations #token');

        this.$doQuery = $('#registrations #doQuery');
        disable(this.$doQuery);
        this.$doAdd = $('#registrations #doAdd');
        disable(this.$doAdd);
    }

    Registrations.prototype = {

        typing: function(event) {
            var skypeId = this.$skypeId.val().trim();
            this.$skypeId.val(skypeId);
            var eventId = this.$eventId.val().trim();
            this.$eventId.val(eventId);
            var params = this.$params.val().trim();

            var validParams = true;
            if (params.length > 0) {
                try {
                    JSON.parse(params);
                } catch (ex) {
                    validParams = false;
                }

                if (validParams) {
                    this.$params.css('color', 'black');
                }
                else {
                    this.$params.css('color', 'red');
                }
            }
            if (skypeId.length > 0 && eventId.length > 0 && validParams) {
                enable(this.$doPost);
            }
            else {
                disable(this.$doPost);
            }
        },

        doClear: function() {
            this.$skypeId.val('');
            this.$eventId.val('');
            this.$params.val('');
            clearLog();
            disable(this.$doPost);
        },

        doPost: function() {
            var self = this;
            var url = '/post/' + this.$skypeId.val();
            var data = {eventId: this.$eventId.val(), substitutions:{}};
            console.log('url:', url);
            if (this.$params.val().length > 0) data.substitutions = JSON.parse(this.$params.val());
            data = JSON.stringify(data);
            console.log('data:', data);
            clearLog();
            $.ajax({
                type: 'POST',
                url: url,
                contentType: 'application/json',
                data: data,
                dataType: 'json',
                success: function(data, textStatus, jqXHR) {
                    console.log('response:', data);
                    console.log('textStatus:', textStatus);
                    addLog('Sending ' + data.count + ' notifications');
                },
                error: function(data, textStatus, jqXHR) {
                    console.log('failed:', textStatus);
                    addLog('Failed - ' + textStatus);
                }
            });
        }
    };

    function Notifier() {
        var self = this;
        console.log('notifier', this);
        this.$skypeId = $('#notifier #skypeId');
        this.$eventId = $('#notifier #eventId');
        this.$params = $('#notifier #params');

        this.$doPost = $('#notifier #doPost');
        disable(this.$doPost);
        this.$doClear = $('#notifier #doClear');

        this.$skypeId.keyup(this.typing.bind(this));
        this.$eventId.keyup(this.typing.bind(this));
        this.$params.keyup(this.typing.bind(this));

        this.$doPost.click(this.doPost.bind(this));
        this.$doClear.click(this.doClear.bind(this));
    }

    Notifier.prototype = {

        typing: function(event) {
            var skypeId = this.$skypeId.val().trim();
            var eventId = this.$eventId.val().trim();
            var params = this.$params.val().trim();
            var validParams = true;

            this.$skypeId.val(skypeId);
            this.$eventId.val(eventId);

            if (params.length > 0) {
                try {
                    JSON.parse(params);
                } catch (ex) {
                    validParams = false;
                }

                if (validParams) {
                    this.$params.css('color', 'black');
                }
                else {
                    this.$params.css('color', 'red');
                }
            }
            if (skypeId.length > 0 && eventId.length > 0 && validParams) {
                enable(this.$doPost);
            }
            else {
                disable(this.$doPost);
            }
        },

        doClear: function() {
            this.$skypeId.val('');
            this.$eventId.val('');
            this.$params.val('');
            clearLog();
            disable(this.$doPost);
        },

        doPost: function() {
            var self = this;
            var url = '/post/' + this.$skypeId.val();
            var data = {eventId: this.$eventId.val(), substitutions:{}};
            console.log('url:', url);
            if (this.$params.val().length > 0) data.substitutions = JSON.parse(this.$params.val());
            data = JSON.stringify(data);
            console.log('data:', data);
            clearLog();
            $.ajax({
                type: 'POST',
                url: url,
                contentType: 'application/json',
                data: data,
                dataType: 'json',
                success: function(data, textStatus, jqXHR) {
                    console.log('response:', data);
                    console.log('textStatus:', textStatus);
                    addLog('Sending ' + data.count + ' notifications');
                },
                error: function(data, textStatus, jqXHR) {
                    console.log('failed:', textStatus);
                    addLog('Failed - ' + textStatus);
                }
            });
        }
    };

    templates = new Templates();
    registrations = new Registrations();
    notifier = new Notifier();
});
